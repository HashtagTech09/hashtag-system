import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const manager = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
let lead;
async function as(role, uid, sql, args = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid || '']);
    return tx.query(sql, args);
  });
}
const change = (stage, version, correction = false, uid = manager, note = null, id = lead) => as('authenticated', uid,
  'select * from public.crm_change_stage($1, $2, $3, $4, $5)', [id, version, stage, note, correction]);

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.studios (id bigint primary key, name text, organization_id bigint);
    grant select on public.studios to service_role;
    insert into public.studios values (1, 'Studio One', 1), (2, 'Studio Two', 1), (3, 'Other Organization', 2);
    insert into auth.users values ('${manager}'), ('${admin}'), ('${outsider}');
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261014074547_crm_stage_outbox.sql', import.meta.url), 'utf8'));
  await db.query(`insert into crm_private.staff_access(auth_user_id, organization_id, studio_id, role)
    values ($1, 1, 1, 'manager'), ($2, 1, null, 'admin')`, [manager, admin]);
  const result = await as('service_role', null, `select public.crm_ingest_lead(1,1,'12345678901234567',
    'Synthetic Lead','test@example.invalid','+919876543210','Jazz',now()) as id`);
  lead = result.rows[0].id;
  await as('service_role', null, `select public.crm_ingest_lead(1,2,'22345678901234567',
    'Other Studio',null,null,null,now())`);
});
after(() => db.close());

test('anonymous and unauthenticated reads and writes are denied', async () => {
  await assert.rejects(as('anon', null, 'select * from public.crm_leads'), /permission denied/);
  await assert.rejects(as('anon', null, 'select * from public.crm_lead_history'), /permission denied/);
  await assert.rejects(as('anon', null, 'select public.crm_change_stage($1,1,$2)', [lead, 'Lost']), /permission denied/);
  await assert.rejects(change('Lost', 1, false, null), /CRM_AUTH_REQUIRED/);
});

test('manager can only read their studio; admin sees their organization', async () => {
  assert.equal((await as('authenticated', manager, 'select * from public.crm_leads')).rows.length, 1);
  assert.equal((await as('authenticated', admin, 'select * from public.crm_leads')).rows.length, 2);
  assert.equal((await as('authenticated', outsider, 'select * from public.crm_leads')).rows.length, 0);
  assert.equal((await as('authenticated', manager, 'select * from public.crm_my_scope()')).rows.length, 1);
  assert.equal((await as('authenticated', outsider, 'select * from public.crm_my_scope()')).rows.length, 0);
});

test('direct writes, ACL self-grants, intake and queue RPCs are forbidden to staff', async () => {
  for (const sql of [
    "update public.crm_leads set stage='Converted'",
    'delete from public.crm_leads',
    'select * from crm_private.staff_access',
    "insert into crm_private.staff_access(auth_user_id,organization_id,role) values (auth.uid(),1,'admin')",
    'select * from crm_private.outbox',
    'select public.crm_claim_events(1)',
    "select public.crm_ingest_lead(1,1,'999','Test',null,null,null,now())",
  ]) await assert.rejects(as('authenticated', manager, sql), /permission denied/);
});

test('cross-studio and unassigned mutations fail without adding events', async () => {
  const other = (await db.query('select id from public.crm_leads where studio_id=2')).rows[0].id;
  await assert.rejects(change('In-Progress', 1, false, manager, null, other), /CRM_ACCESS_DENIED/);
  await assert.rejects(change('In-Progress', 1, false, outsider), /CRM_ACCESS_DENIED/);
  assert.equal((await db.query('select * from crm_private.outbox')).rows.length, 2);
});

test('saving a stage atomically creates one history row and snapshot event', async () => {
  await change('In-Progress', 1, false, manager, 'Synthetic test note');
  const history = (await db.query('select * from public.crm_lead_history where lead_id=$1 order by version', [lead])).rows;
  const events = (await db.query('select * from crm_private.outbox where lead_id=$1 order by version', [lead])).rows;
  assert.equal(history.length, 2);
  assert.equal(events.length, 2);
  assert.equal(history[1].actor_id, manager);
  assert.equal(history[1].note, 'Synthetic test note');
  assert.equal(events[1].event_id, history[1].id);
  assert.equal(events[1].meta_lead_id, '12345678901234567');
  assert.equal(events[1].stage, 'In-Progress');
  assert.deepEqual(events[1].occurred_at, history[1].changed_at);
  assert.equal('note' in events[1], false);
});

test('repeat saves are no-ops and stale versions cannot overwrite a change', async () => {
  await change('In-Progress', 2);
  await assert.rejects(change('Qualified', 1), /CRM_VERSION_CONFLICT/);
  assert.equal((await db.query('select * from crm_private.outbox where lead_id=$1', [lead])).rows.length, 2);
});

test('failed validation rolls back all state and cannot fabricate skipped stages', async () => {
  await assert.rejects(change('Intake', 2), /CRM_INVALID_TRANSITION/);
  await assert.rejects(change('Converted', 2), /CRM_VERIFIED_PAYMENT_REQUIRED/);
  await assert.rejects(change('Lost', 2, false, manager, 'x'.repeat(2001)), /CRM_NOTE_TOO_LONG/);
  const other = (await db.query('select id from public.crm_leads where studio_id=2')).rows[0].id;
  await assert.rejects(change('Qualified', 1, false, admin, null, other), /CRM_INVALID_TRANSITION/);
  assert.equal((await db.query('select version from public.crm_leads where id=$1', [lead])).rows[0].version, 2);
});

test('duplicate intake preserves a changed stage and rejects cross-scope remapping', async () => {
  await as('service_role', null, "select public.crm_ingest_lead(1,1,'12345678901234567','Duplicate',null,null,null,now())");
  assert.equal((await db.query('select stage from public.crm_leads where id=$1', [lead])).rows[0].stage, 'In-Progress');
  await assert.rejects(as('service_role', null, "select public.crm_ingest_lead(1,2,'12345678901234567','Duplicate',null,null,null,now())"), /CRM_LEAD_SCOPE_CONFLICT/);
  await assert.rejects(as('service_role', null, "select public.crm_ingest_lead(1,3,'999','Wrong org',null,null,null,now())"), /CRM_INVALID_STUDIO/);
});

test('delivery claims only the earliest event per lead; wrong lease cannot acknowledge', async () => {
  const events = (await as('service_role', null, 'select * from public.crm_claim_events(20)')).rows;
  assert.equal(events.length, 2);
  assert.ok(events.every(event => event.version === 1));
  assert.equal((await as('service_role', null, 'select * from public.crm_claim_events(20)')).rows.length, 0);
  const event = events.find(event => event.lead_id === lead);
  const wrong = await as('service_role', null, "select public.crm_finish_event($1,$2,'delivered') as ok", [event.event_id, admin]);
  assert.equal(wrong.rows[0].ok, false);
  await as('service_role', null, "select public.crm_finish_event($1,$2,'retry','NETWORK_ERROR',30)", [event.event_id, event.lease_id]);
  await db.query("update crm_private.outbox set due_at=now()-interval '1 minute' where event_id=$1", [event.event_id]);
  const retried = (await as('service_role', null, 'select * from public.crm_claim_events(20)')).rows[0];
  assert.equal(retried.event_id, event.event_id);
  assert.deepEqual(retried.occurred_at, event.occurred_at);
  assert.equal(retried.attempts, 2);
  assert.notEqual(retried.lease_id, event.lease_id);
  await as('service_role', null, "select public.crm_finish_event($1,$2,'delivered')", [retried.event_id, retried.lease_id]);
  const next = (await as('service_role', null, 'select * from public.crm_claim_events(20)')).rows;
  assert.equal(next.length, 1);
  assert.equal(next[0].version, 2);
  await as('service_role', null, "select public.crm_finish_event($1,$2,'failed','META_100')", [next[0].event_id, next[0].lease_id]);
});

test('an outbox failure rolls back the stage and history together', async () => {
  await db.exec("alter table crm_private.outbox add constraint simulate_queue_failure check(stage <> 'Qualified')");
  await assert.rejects(change('Qualified', 2), /simulate_queue_failure/);
  assert.equal((await db.query('select version from public.crm_leads where id=$1', [lead])).rows[0].version, 2);
  assert.equal((await db.query('select * from public.crm_lead_history where lead_id=$1', [lead])).rows.length, 2);
  await db.exec('alter table crm_private.outbox drop constraint simulate_queue_failure');
});

test('lost is terminal; admin corrections require a reason and are held from Meta', async () => {
  await change('Lost', 2);
  await assert.rejects(change('In-Progress', 3), /CRM_INVALID_TRANSITION/);
  await assert.rejects(change('Intake', 3, true), /CRM_ADMIN_REQUIRED/);
  await assert.rejects(change('Intake', 3, true, admin), /CRM_CORRECTION_REASON_REQUIRED/);
  await change('Intake', 3, true, admin, 'Accidental loss correction');
  const event = (await db.query('select * from crm_private.outbox where lead_id=$1 and version=4', [lead])).rows[0];
  assert.equal(event.status, 'held');
  assert.equal((await as('service_role', null, 'select * from public.crm_claim_events(20)')).rows.length, 0);
});

test('revoking CRM access immediately removes read and write access', async () => {
  await db.query('update crm_private.staff_access set active=false where auth_user_id=$1', [manager]);
  assert.equal((await as('authenticated', manager, 'select * from public.crm_leads')).rows.length, 0);
  await assert.rejects(change('In-Progress', 4), /CRM_ACCESS_DENIED/);
});

test('no CRM function grants execute to PUBLIC or anon and exposed functions are invoker', async () => {
  const rows = (await db.query(`select p.proname, p.prosecdef, n.nspname,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='crm_private' or (n.nspname='public' and p.proname like 'crm_%')`)).rows;
  assert.ok(rows.length > 8);
  for (const row of rows) {
    assert.equal(row.anon_execute, false, row.proname);
    if (row.nspname === 'public') assert.equal(row.prosecdef, false, row.proname);
  }
});
