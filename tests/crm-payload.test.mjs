import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'lossless-json';
import { buildPayload, deliveryResult, digest, eventProblem, readConfig, validWorkerToken } from '../supabase/functions/crm-meta-dispatch/payload.ts';

const now = Math.floor(Date.now() / 1000);
const event = {
  event_id: '11111111-1111-4111-8111-111111111111', lead_id: 'synthetic', version: 2,
  stage: 'In-Progress', occurred_at: new Date((now - 60) * 1000).toISOString(),
  meta_lead_id: '12345678901234567', email: ' Test@Example.invalid ', phone: '+91 98765 43210', attempts: 1, lease_id: 'synthetic',
};
const config = {
  CRM_META_ENABLED: 'true', CRM_META_MODE: 'test', CRM_DEPLOYMENT_PROJECT_REF: 'isolated',
  SUPABASE_URL: 'https://isolated.supabase.co', CRM_META_DATASET_ID: '999',
  CRM_META_GRAPH_VERSION: 'v99.0', CRM_META_ACCESS_TOKEN: 'synthetic-not-a-token', CRM_META_TEST_EVENT_CODE: 'TEST',
};
const getConfig = (overrides = {}) => readConfig(key => ({ ...config, ...overrides })[key]);

test('Meta payload preserves exact numeric lead ID, timestamp and stable event ID', async () => {
  const body = await buildPayload(event, 'TEST');
  const parsed = parse(body);
  assert.match(body, /"lead_id":12345678901234567/);
  assert.equal(parsed.data[0].user_data.lead_id.toString(), event.meta_lead_id);
  assert.equal(parsed.data[0].event_time.toString(), String(now - 60));
  assert.equal(parsed.data[0].event_id, `crm:${event.event_id}`);
  assert.equal(parsed.data[0].event_name, 'In-Progress');
  assert.equal(parsed.data[0].action_source, 'system_generated');
  assert.equal(parsed.data[0].custom_data.event_source, 'crm');
  assert.equal(parsed.test_event_code, 'TEST');
  assert.equal(parsed.data[0].user_data.em[0], await digest('test@example.invalid'));
  assert.equal(parsed.data[0].user_data.ph[0], await digest('919876543210'));
  assert.ok(!body.includes('Test@') && !body.includes('98765 43210'));
  assert.equal(await buildPayload({ ...event, attempts: 5 }, 'TEST'), body);
});

test('does not guess country codes or send notes and payment values', async () => {
  const body = JSON.parse(await buildPayload({ ...event, phone: '9876543210', email: 'invalid', note: 'Private note' }));
  assert.deepEqual(Object.keys(body.data[0].user_data), ['lead_id']);
  assert.equal('test_event_code' in body, false);
  assert.equal('value' in body.data[0].custom_data, false);
  assert.ok(!JSON.stringify(body).includes('Private note'));
});

test('events are validated without refreshing old timestamps', () => {
  assert.equal(eventProblem(event, now), null);
  assert.equal(eventProblem({ ...event, occurred_at: new Date((now - 8 * 86400) * 1000).toISOString() }, now), 'EVENT_EXPIRED');
  assert.equal(eventProblem({ ...event, occurred_at: 'invalid' }, now), 'INVALID_EVENT_TIME');
  assert.equal(eventProblem({ ...event, meta_lead_id: 'local-123' }, now), 'INVALID_META_LEAD_ID');
  assert.equal(eventProblem({ ...event, stage: 'Purchase' }, now), 'INVALID_STAGE');
});

test('disabled by default; test cannot use the production project or dataset', () => {
  assert.equal(readConfig(() => undefined), null);
  assert.equal(getConfig().datasetId, '999');
  assert.throws(() => getConfig({ CRM_META_DATASET_ID: '666763039533944' }), /ISOLATION/);
  assert.throws(() => getConfig({ CRM_DEPLOYMENT_PROJECT_REF: 'cughejedfefvblxyodtm', SUPABASE_URL: 'https://cughejedfefvblxyodtm.supabase.co' }), /ISOLATION/);
  assert.throws(() => getConfig({ CRM_META_TEST_EVENT_CODE: '' }), /ISOLATION/);
  assert.throws(() => getConfig({ CRM_DEPLOYMENT_PROJECT_REF: 'wrong' }), /CONFIG/);
  assert.throws(() => getConfig({ CRM_META_GRAPH_VERSION: '' }), /CONFIG/);
});

test('production requires explicit approval, exact project and dataset, and no test code', () => {
  const production = { CRM_META_MODE: 'production', CRM_META_DATASET_ID: '666763039533944',
    CRM_DEPLOYMENT_PROJECT_REF: 'cughejedfefvblxyodtm', SUPABASE_URL: 'https://cughejedfefvblxyodtm.supabase.co', CRM_META_TEST_EVENT_CODE: '' };
  assert.throws(() => getConfig(production), /LIVE_GATE/);
  assert.equal(getConfig({ ...production, CRM_META_LIVE_APPROVED: 'true' }).datasetId, '666763039533944');
  assert.throws(() => getConfig({ ...production, CRM_META_LIVE_APPROVED: 'true', CRM_META_TEST_EVENT_CODE: 'TEST' }), /LIVE_GATE/);
});

test('worker requires dedicated bearer token, not a public key or missing secret', async () => {
  const secret = 's'.repeat(40);
  assert.equal(await validWorkerToken(`Bearer ${secret}`, secret), true);
  assert.equal(await validWorkerToken('Bearer public-key', secret), false);
  assert.equal(await validWorkerToken(null, secret), false);
  assert.equal(await validWorkerToken('Bearer short', 'short'), false);
  assert.equal(await validWorkerToken(`Bearer ${secret}`, undefined), false);
});

test('only Meta acceptance is delivered; transient failures retry with bounded attempts', () => {
  assert.equal(deliveryResult(200, { events_received: 1 }, 1).status, 'delivered');
  assert.equal(deliveryResult(200, { events_received: 0 }, 1).status, 'failed');
  assert.equal(deliveryResult(400, { error: { code: 100, message: 'sensitive provider text' } }, 1).code, 'META_100');
  assert.equal(deliveryResult(429, {}, 1).status, 'retry');
  assert.equal(deliveryResult(500, {}, 8).status, 'failed');
  assert.equal(deliveryResult(0, null, 1).code, 'NETWORK_ERROR');
  assert.equal(deliveryResult(400, { error: { is_transient: true } }, 1).status, 'retry');
});
