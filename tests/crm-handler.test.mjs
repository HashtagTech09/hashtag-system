import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDispatchHandler } from '../supabase/functions/crm-meta-dispatch/handler.ts';

const secret = 'test-worker-secret-never-deploy-this-value';
const config = {
  CRM_META_WORKER_SECRET: secret, CRM_META_ENABLED: 'true', CRM_META_MODE: 'test',
  CRM_DEPLOYMENT_PROJECT_REF: 'isolated', SUPABASE_URL: 'https://isolated.supabase.co',
  CRM_META_DATASET_ID: '999', CRM_META_ACCESS_TOKEN: 'synthetic-test-token', CRM_META_TEST_EVENT_CODE: 'TEST', CRM_META_GRAPH_VERSION: 'v99.0',
};
const event = { event_id: '11111111-1111-4111-8111-111111111111', lead_id: 'synthetic', stage: 'Qualified', version: 3,
  occurred_at: new Date().toISOString(), meta_lead_id: '12345678901234567', attempts: 1, lease_id: 'synthetic-lease', email: 'test@example.invalid', phone: null };
function fixture(overrides = {}, responseStatus = 200, responseBody = { events_received: 1 }) {
  const requests = [], acknowledgements = [];
  let claims = 0;
  const handler = createDispatchHandler({
    get: key => ({ ...config, ...overrides })[key],
    queue: () => ({
      claim: async () => { claims++; return [event]; },
      finish: async (item, result) => { acknowledgements.push({ item, result }); return true; },
    }),
    fetch: async (url, options) => { requests.push({ url, options }); return Response.json(responseBody, { status: responseStatus }); },
  });
  return { handler, requests, acknowledgements, claims: () => claims };
}
const request = (token = secret, method = 'POST') => new Request('https://worker.invalid', { method, headers: { Authorization: `Bearer ${token}` } });

test('worker denies public-key and missing-secret requests before accessing data', async () => {
  const test = fixture();
  assert.equal((await test.handler(request('anon-key'))).status, 401);
  assert.equal((await test.handler(request(secret, 'GET'))).status, 405);
  assert.equal(test.claims(), 0);
  assert.equal(test.requests.length, 0);
  const absent = fixture({ CRM_META_WORKER_SECRET: '' });
  assert.equal((await absent.handler(request())).status, 401);
});

test('disabled or invalid deployment does not claim or send events', async () => {
  const disabled = fixture({ CRM_META_ENABLED: 'false' });
  assert.deepEqual(await (await disabled.handler(request())).json(), { status: 'disabled', processed: 0 });
  assert.equal(disabled.claims(), 0);
  const wrong = fixture({ CRM_META_DATASET_ID: '666763039533944' });
  assert.equal((await wrong.handler(request())).status, 503);
  assert.equal(wrong.requests.length, 0);
  assert.equal(wrong.claims(), 0);
});

test('queued event sends through server-only header and records acceptance without PII in response', async () => {
  const test = fixture();
  const response = await test.handler(request());
  assert.deepEqual(await response.json(), { processed: 1 });
  assert.equal(test.requests[0].url, 'https://graph.facebook.com/v99.0/999/events');
  assert.equal(test.requests[0].options.headers.Authorization, 'Bearer synthetic-test-token');
  assert.ok(!test.requests[0].options.body.includes('synthetic-test-token'));
  assert.equal(test.acknowledgements[0].result.status, 'delivered');
  assert.equal(test.acknowledgements[0].item.lease_id, 'synthetic-lease');
});

test('provider errors are redacted and queued for retry', async () => {
  const test = fixture({}, 503, { error: { message: 'sensitive contact text', code: 2 } });
  const response = await test.handler(request());
  assert.equal(test.acknowledgements[0].result.status, 'retry');
  assert.equal(test.acknowledgements[0].result.code, 'META_2');
  assert.ok(!(await response.text()).includes('sensitive'));
});

test('expired events are not sent; lost acknowledgements return a retryable error', async () => {
  let calls = 0, outcome;
  const handler = createDispatchHandler({
    get: key => config[key], now: () => Date.now() + 9 * 86400 * 1000,
    queue: () => ({ claim: async () => [event], finish: async (_, result) => { outcome = result; return false; } }),
    fetch: async () => { calls++; throw new Error('should not send'); },
  });
  assert.equal((await handler(request())).status, 503);
  assert.equal(calls, 0);
  assert.equal(outcome.status, 'expired');
});
