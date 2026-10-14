# Meta CRM stage changes

Implementation date: 14 October 2026. Status: **implemented for review; not deployed or live**.

## Scope and verified target

- Repository: `HashtagTech09/hashtag-system`, branch `codex/meta-crm-stage-events`.
- Intended Management System Supabase project: `cughejedfefvblxyodtm`.
- Intended production CRM dataset: `666763039533944`.
- This is **not** the `hashtag.dance` website project `mfcvdlfshkqdrevgadnw`.
- The checked Management System had no existing CRM lead tables or lead screen. This adds a separate module at `/leads`; it does not migrate or change the website CRM.
- No production schema, staff assignments, secrets, Meta subscriptions or payment routes were changed. No emails were sent.

## Implemented flow

1. An individually authenticated staff member with an explicit CRM studio assignment opens `/leads`.
2. The screen sends `crm_change_stage` with the lead UUID, expected version, selected stage, optional note and correction flag.
3. The database checks the staff assignment and studio/organization scope, locks the record and checks its version and transition.
4. The saved change fires a database trigger. The lead, audit entry and event snapshot commit atomically. If queuing fails, the stage change rolls back.
5. A scheduled server-only worker claims the earliest outstanding event per lead. It sends CAPI, records acceptance or a sanitized failure code, and retries transient errors with backoff.
6. History shows actual changes, actor Auth UUID, time, note and delivery status. `delivered` means Meta returned `events_received: 1`, not proof of ad attribution or optimization eligibility.

All new lead/history reads require the CRM assignment in database RLS. Anonymous reads, direct authenticated writes, self-granting access and browser calls to intake/queue RPCs are denied. Revoking an assignment is checked on the next request without waiting for a refreshed JWT. The existing Auth client is reused; no service key is sent to the browser.

## Deliberate release gates

- Normal transitions: `Intake -> In-Progress -> Qualified`; any of these can become `Lost`.
- Do not synthesize a contact or qualification event for a skipped stage. Skips are rejected pending an agreed business definition.
- `Converted` cannot be set manually. Verified-payment conversion is a separate integration and remains unimplemented in this change. The emails differ on whether drop-ins or only plans qualify; resolve this before payment integration.
- Admin corrections require a reason and are audited. Their Meta events are **held**. A held, failed or expired event blocks later events for that lead until reviewed. There is intentionally no client-side force-send or history deletion.
- Genuine Meta intake is not connected. `crm_ingest_lead` provides a service-only, duplicate-safe contract; it does not itself verify Page webhooks or retrieve Meta lead details. The caller must do that. Existing website webhook code must not be reused unchanged: the reviewed version had a source-constraint mismatch and conditional signature checking.
- No web Pixel events are emitted by this screen. These are server-side CRM lifecycle events, not new Schedule/Purchase events, and carry no invented payment value.
- Official Meta payload documentation returned HTTP 429 during research. Treat the email's payload mapping as proposed until checked against current Meta documentation and real Test Events. Do not enable production just because local tests pass.

## Payload and reliability

The event name is the actual new stage; `event_time` is the saved change time in Unix seconds. `event_id` is `crm:<history UUID>` and never changes on retry. `action_source` is `system_generated`. `custom_data` contains `event_source: crm` and `lead_event_source: Hashtag Management System`.

The genuine `meta_lead_id` is stored as text and serialized losslessly as a JSON number. It must not be a locally generated UUID or the website's registration event ID. Email and international-format phone are normalized and SHA-256 hashed before transmission. Invalid/ambiguous phone formats are omitted rather than assigned a guessed country code. Notes, staff identities and raw contact information are not sent to Meta. Hashing is not anonymization; review consent/privacy requirements before activation.

Workers use five-minute leases and skip locked rows. Lost acknowledgements retry with the same event ID. Transient failures retry up to eight delivery attempts; expired events (over seven days) retain their original timestamps and are marked expired. A dead worker's lease can be reclaimed. Permanent failures and administrative corrections need operator review. Raw provider responses and access tokens are never logged or returned.

## Configuration (all disabled by default)

Frontend: `VITE_CRM_LEADS_ENABLED=true` only after the migration and staff assignment acceptance tests. This is a visibility flag, not a security boundary.

Server secrets/configuration, never `VITE_` values:

| Name | Requirement |
| --- | --- |
| `CRM_META_ENABLED` | Exact `true`; otherwise no queue claim or event send |
| `CRM_META_MODE` | `test` or `production`; no implicit fallback |
| `CRM_DEPLOYMENT_PROJECT_REF` | Must match the function's actual `SUPABASE_URL` project reference |
| `CRM_META_DATASET_ID` | Approved dataset; production must be `666763039533944` |
| `CRM_META_GRAPH_VERSION` | Explicit current, independently verified Graph version |
| `CRM_META_ACCESS_TOKEN` | Scoped Meta server token, provisioned through approved secret storage |
| `CRM_META_WORKER_SECRET` | Dedicated random bearer secret of at least 32 characters, for the scheduler only |
| `CRM_META_TEST_EVENT_CODE` | Required in test mode, forbidden in production mode |
| `CRM_META_LIVE_APPROVED` | Exact `true` required for production delivery |

The function uses platform `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Test mode rejects the production project and production dataset, even if a test-event code is present. Use a separate testing project **and** separate testing dataset. The function does not accept browser Origin as proof of production. Missing configuration fails closed.

The repository's existing `supabase/config.toml` project ID is stale (`plrpurjponddhelgtebw`). Do not run an unqualified deployment or bulk migration push from it. Confirm the target reference and migration history explicitly before any deployment.

## Activation checklist

- [ ] Resolve Converted/skipped-stage/correction semantics with Manas and confirm the current CRM CAPI contract and Graph version.
- [ ] Choose an isolated Supabase test project and separate Meta testing dataset. Do not copy student data into test fixtures.
- [ ] Review and apply only `20261014074547_crm_stage_outbox.sql` to that test project. Run Supabase advisors and repeat the permission checks through the actual REST API.
- [ ] Provision explicit entries in `crm_private.staff_access`, using confirmed existing Auth user UUIDs. Managers get the correct organization and one row per assigned studio; admins get an organization-level row with no studio. Do not automatically trust browser role flags or grant all staff access.
- [ ] Connect a signed Meta Page webhook with mandatory signature verification, allowlisted Page/form routing and server-side retrieval of genuine lead details. Feed `crm_ingest_lead`; verify organization/studio mapping and duplicate delivery behavior. This connector is still pending.
- [ ] Deploy only `crm-meta-dispatch` to the verified test reference, with test-only credentials. Configure an authenticated scheduler to POST to it every minute; keep its bearer secret in a vault, not in source, client code or plain cron SQL.
- [ ] Use Meta's testing tool to create a genuine test lead; verify Intake, In-Progress, Qualified and Lost with the original lead ID and time. Verify duplicate handling, temporary failures and the Test Events/diagnostics results. Do not use the synthetic IDs in this repository against Meta.
- [ ] Ask Shivek and the intended studio managers to use their own accounts. Confirm authorized access, cross-studio denial, correction restrictions, history and mobile use. Mocked browser tests do not establish real staff acceptance.
- [ ] Obtain production deployment/activation approval. Preserve a schema backup and current permissions; explicitly confirm project and dataset. Apply additive migration, provision reviewed assignments, deploy worker disabled, then enable the screen for the pilot group.
- [ ] Only after pilot signoff, enable production worker with the explicit live-approval gate. Check queue age, errors and Meta acceptance after the first real transition. Alert on failed/expired/held events and increasing queue age; monitoring ownership remains to be assigned.
- [ ] Implement verified-payment conversion separately, with advance notice before touching Razorpay/live payment paths. Use the existing verified-payment source and transaction/event deduplication, not an editable status field as payment proof.

No old leads should be bulk replayed with new timestamps. Failure recovery must retain immutable event IDs/times; do not delete or skip audit rows to unblock a queue.

## Rollback without deleting data

1. Disable the scheduled dispatch and set `CRM_META_ENABLED=false`. Already in-flight network sends cannot be recalled.
2. Set the frontend flag false and redeploy the prior UI if needed.
3. If mutations must stop, revoke authenticated execution of `public.crm_change_stage` **and** `crm_private.change_stage` in a reviewed production change; disabling UI alone is insufficient.
4. Preserve all lead/history/outbox rows and staff-assignment evidence. Do not drop tables, delete events, rotate unrelated credentials or modify payment data as part of rollback.
5. Before re-enabling, review queued/held/expired events and reconcile accepted event IDs. Do not relabel an unverified send as delivered.

## Local verification

Node 24 is used for native TypeScript imports in server tests.

```sh
npm ci --ignore-scripts
npm run test:crm
npm test
npm run test:crm:ui
npm run build
deno check --config supabase/functions/crm-meta-dispatch/deno.json supabase/functions/crm-meta-dispatch/index.ts
```

- 25 focused database/payload/worker tests passed in isolated PGlite and mocked HTTP. Includes anonymous/cross-studio denial, scope revocation, immutable retry identity, long lead IDs, stale saves and full rollback when outbox insertion fails.
- 6 Playwright checks passed, including desktop/mobile screenshots, server-contract payloads, denied access, conflicts, Lost and reason-required corrections. All non-local requests were mocked or blocked.
- Existing 32 Vitest tests passed. Frontend build and Deno worker check passed.
- Full app typechecking is blocked by the existing `PromotionRequests.tsx:97` error, reproduced from unchanged commit `3559e18` with the same dependency runtime. No new CRM type errors remained.
- PGlite is not a deployed Supabase/PostgREST environment; mock HTTP is not evidence Meta received anything. Real API/advisor checks, Test Events, scheduler verification and staff acceptance remain release blockers.
- The base npm lockfile did not include several dependencies already present in `package.json`. Regenerating it records those dependencies as well as the two new pinned test/payload packages. Supabase JS is pinned to `2.110.9`, the version present in the original local checkout, and the worker uses the same version. No blanket dependency upgrade or `audit fix --force` was run.
- `npm audit` reported 36 dependency findings (7 moderate, 27 high, 2 critical). The critical findings are in the existing Vitest/tinypool test-tool chain and require a separately validated major-version update. These findings are not resolved by this feature; the whole application's security must not be declared verified on the strength of these tests.
