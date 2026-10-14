import { test, expect } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const leadId = "22222222-2222-4222-8222-222222222222";
const user = { id: userId, aud: "authenticated", role: "authenticated", email: "demo@example.invalid", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };

async function setup(page, options: { denied?: boolean; conflict?: boolean; stage?: string; admin?: boolean } = {}) {
  const lead = { id: leadId, organization_id: 1, studio_id: 1, meta_lead_id: "12345678901234567", name: "Demo Lead", email: "demo.lead@example.invalid", phone: "+91 90000 00000", style: "Jazz", stage: options.stage || "Intake", version: 1, created_at: new Date().toISOString(), changed_at: new Date().toISOString(), actor_id: null, change_note: null, is_correction: false };
  const history = [{ id: "33333333-3333-4333-8333-333333333333", lead_id: leadId, organization_id: 1, studio_id: 1, version: 1, from_stage: null, to_stage: lead.stage, changed_at: lead.changed_at, actor_id: null, note: null, is_correction: false, delivery_status: "queued", delivery_code: null, attempts: 0 }];
  const changes: unknown[] = [];
  await page.addInitScript(({ user }) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, exp, role: 'authenticated' }))}.synthetic`;
    localStorage.setItem('sb-crm-local-auth-token', JSON.stringify({ access_token: token, refresh_token: 'synthetic', token_type: 'bearer', expires_in: 3600, expires_at: exp, user }));
  }, { user });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
    // All non-local networking is mocked or blocked; no production calls in UI tests.
    if (url.hostname !== 'crm-local.supabase.co') return route.abort();
    const json = (data, status = 200, extraHeaders = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...extraHeaders }, body: JSON.stringify(data) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname === '/rest/v1/users') return json({ id: 1, auth_id: userId, name: 'Demo Manager', email: user.email, organization_id: 1, scope_restricted: true });
    if (url.pathname === '/rest/v1/user_roles') return json([{ id: 1, role_id: 1, organization_id: 1, is_primary: true, roles: { name: options.admin ? 'admin' : 'manager', type: 'staff' } }]);
    if (url.pathname === '/rest/v1/rpc/crm_my_scope') return json(options.denied ? [] : [{ studio_id: 1, studio_name: 'Demo Studio', organization_id: 1, is_admin: !!options.admin }]);
    if (url.pathname === '/rest/v1/crm_leads') return json([lead], 200, { 'Content-Range': '0-0/1' });
    if (url.pathname === '/rest/v1/crm_lead_history') return json(history);
    if (url.pathname === '/rest/v1/rpc/crm_change_stage') {
      const body = route.request().postDataJSON();
      changes.push(body);
      if (options.conflict) return json({ code: 'P0001', message: 'CRM_VERSION_CONFLICT' }, 400);
      lead.stage = body.p_stage; lead.version++; lead.actor_id = userId;
      history.unshift({ ...history[0], id: '44444444-4444-4444-8444-444444444444', version: lead.version, from_stage: history[0].to_stage, to_stage: lead.stage, actor_id: userId, note: body.p_note || null, is_correction: body.p_correction, delivery_status: body.p_correction ? 'held' : 'queued' });
      return json(lead);
    }
    return json([]);
  });
  await page.goto('/leads');
  return changes;
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`${viewport.name}: saves a real stage change request and shows queued history`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const changes = await setup(page);
    await expect(page.getByRole('heading', { name: 'Demo Lead', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Update stage', exact: true }).click();
    await page.getByRole('button', { name: 'Save stage', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Stage saved' })).toBeVisible();
    expect(changes).toEqual([{ p_lead: leadId, p_version: 1, p_stage: 'In-Progress', p_note: null, p_correction: false }]);
    await page.getByRole('button', { name: 'History for Demo Lead' }).click();
    await expect(page.getByLabel('Lead history').getByText(/by you/)).toBeVisible();
    await expect(page.getByLabel('Lead history').getByText('Meta: queued').first()).toBeVisible();
    await expect(page.getByText('1 leads', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/crm-${viewport.name}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('access denied does not fetch or render private lead rows', async ({ page }) => {
  let leadReads = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/rest/v1/crm_leads') leadReads++; });
  await setup(page, { denied: true });
  await expect(page.getByRole('alert')).toHaveText('No CRM studio access assigned to this account.');
  expect(leadReads).toBe(0);
  await expect(page.getByText('Demo Lead', { exact: true })).toHaveCount(0);
});

test('conflict is visible and never claims successful Meta delivery', async ({ page }) => {
  await setup(page, { conflict: true });
  await page.getByRole('button', { name: 'Update stage', exact: true }).click();
  await page.getByRole('button', { name: 'Save stage', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This lead changed');
  await expect(page.getByText('Stage saved. Meta update queued.')).toHaveCount(0);
});

test('lost requires a saved action; converted has no manual action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const changes = await setup(page, { stage: 'Qualified' });
  await expect(page.getByRole('button', { name: 'Converted', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Update stage', exact: true }).click();
  expect(changes).toHaveLength(0);
  await page.getByLabel('Note (optional)').fill('Synthetic follow-up note');
  await page.screenshot({ path: 'test-results/crm-mobile-dialog.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Save stage' }).click();
  expect(changes).toEqual([{ p_lead: leadId, p_version: 1, p_stage: 'Lost', p_note: 'Synthetic follow-up note', p_correction: false }]);
});

test('admin corrections require a reason and show held delivery', async ({ page }) => {
  const changes = await setup(page, { stage: 'Lost', admin: true });
  await page.getByRole('button', { name: 'Update stage', exact: true }).click();
  await page.getByLabel('Administrative correction').check();
  await page.getByLabel('New stage').selectOption('Intake');
  await expect(page.getByRole('button', { name: 'Save stage' })).toBeDisabled();
  await page.getByLabel('Correction reason', { exact: true }).fill('Accidental stage selection');
  await page.getByRole('button', { name: 'Save stage' }).click();
  await expect(page.getByText('Stage corrected. Meta delivery is held for review.')).toBeVisible();
  expect(changes).toHaveLength(1);
  await page.getByRole('button', { name: 'History for Demo Lead' }).click();
  await expect(page.getByText('Meta: held', { exact: true })).toBeVisible();
});
