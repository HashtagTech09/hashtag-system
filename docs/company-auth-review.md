# Company Authentication Review

Reviewed on 8 October 2026. This report concerns only HashtagTech09/hashtag-system.

## Status

- Code is on `codex/company-auth-recovery`, not merged into main.
- Preview deployment of application commit `beac6ad` is READY:
  https://hashtag-system-ejtrgv7wv-hashtagtech09.vercel.app
- Preview is protected by Vercel Authentication. The connector can deploy and read status,
  but cannot fetch the protected page or build logs with its current permissions.
- Local review is available at http://127.0.0.1:8086/login.
- No company database rows, Auth settings, passwords, or production environment variables
  have been changed. Original Account A was not modified for this task.
- Company administrator provisioning and a real recovery/login test are still pending.

## Diagnosed Causes

1. The company production JavaScript references the OLD Supabase project
   `uebqyvlxzxqtiijjlkis`, not the new company project `cughejedfefvblxyodtm`.
   Vercel initially had no environment variables, so the committed `.env` supplied
   the old connection. A confirmed user in the new project cannot authenticate against
   the old project using its new-project password. This mismatch is confirmed; the
   user's password itself was not inspected or tested.
2. Password recovery did not transition out of its loading state when no session was
   established. Invalid links could leave a disabled update button indefinitely.
3. Recovery links landing at the site root had no dedicated recovery routing and could
   enter the ordinary login/dashboard flow. Returning to login after an update also
   retained the recovery session and could immediately redirect to the dashboard.
4. The new project's `tech@hashtag.dance` Auth account exists, is email-confirmed,
   has a password, and is not banned. It has no corresponding public staff profile or
   application role. Authentication alone is therefore insufficient for admin access.
5. The old frontend treated a missing staff profile as a superadmin. This is removed.

The source is a Vite/React SPA, not Next.js. There are no Next.js server clients,
middleware, or cookie callback routes to repair. Supabase manages browser sessions.
Auth logs showed successful recovery email dispatch and verification, plus expired-link
failures. No real password-update success was verified during this work.

## Changes

| Files | Purpose |
| --- | --- |
| `.env` (removed), `.env.example`, `.gitignore` | Stop inheriting Account A's connection; keep deployment configuration out of source control. |
| `vite.config.ts` | Fail builds with missing/wrong company project configuration or a legacy key with the wrong project/role. Reject secret/service-role keys. |
| `src/integrations/supabase/client.ts` | Explicit callback initialization, implicit links and PKCE code handling, and failure detection before routing cleans the URL. |
| `src/lib/authRecovery.ts` | Capture only callback intent, never token values; clean consumed callback parameters. |
| `src/pages/ResetPassword.tsx` | Verify the session with Auth, expose expired-link errors, update password, end the local session, and return to login. |
| `src/hooks/useAuth.tsx` | Preserve same-user workflows on focus/refresh, reject stale profile results after signout, and fail closed on authorization lookup failure. |
| `src/App.tsx`, `src/components/AppSidebar.tsx` | Route recovery separately; require staff roles and remove implicit no-profile admin access. |
| `package.json`, `package-lock.json`, `vercel.json` | Repair the inconsistent lockfile, pin Supabase to the existing requested 2.99.1 version, and use reproducible installs. |
| `src/App.auth.test.tsx`, `src/hooks/useAuth.test.tsx`, `src/pages/ResetPassword.test.tsx`, `src/lib/authRecovery.test.ts`, `src/integrations/supabase/client.test.ts` | Authorization, session, UI, and real-SDK callback regression tests. |
| `scripts/company-admin-pending-approval.sql` | Guarded, idempotent company-admin provisioning for later approval. Not executed and not an automatic migration. |

## Vercel Environment Configuration

Project name is `hashtag-system`; `hashtag-system-gamma.vercel.app` is its production alias.
The following were created and verified ONLY for Preview, scoped to the review branch:

| Variable | Scope | Storage |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Preview / codex/company-auth-recovery | Plain |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Preview / codex/company-auth-recovery | Encrypted |
| `VITE_SUPABASE_PROJECT_ID` | Preview / codex/company-auth-recovery | Plain |

The public key was obtained from the new company's project. No service-role key is
needed in the browser or Vercel frontend. `NEXT_PUBLIC_*` names are not used.
Production and Development scopes remain unchanged. The local process receives only
public configuration in memory; no key was added to source files.

## Supabase and Admin Setup Awaiting Approval

The company Auth Site URL is already https://hashtag-system-gamma.vercel.app.
Its only allowed redirect is currently https://hashtag-system-gamma.vercel.app/**.
Email sign-in is enabled. These settings were verified through the API and dashboard;
none were changed.

Before live preview recovery testing, approve adding this exact redirect:
https://hashtag-system-ejtrgv7wv-hashtagtech09.vercel.app/reset-password

The established highest application role is `admin` (organization role), not a new
`superadmin` role. After authentication is tested and approval is given, the prepared
SQL links the existing confirmed company Auth UUID to a new public staff row in
Hashtag Dance Company (organization 1), assigns the existing admin role, and sets only
that account's `scope_restricted` to false. It stops on conflicting identities and
does not reset a password, create an Auth user, or edit anyone else's permissions.

## Verification

- All 60 automated tests passed, including the existing business-rule tests.
- Four tests use the actual Supabase SDK with mocked HTTP: implicit recovery,
  one-time PKCE exchange, missing browser verifier, and rejected callback credentials.
- Password form tests cover valid/invalid sessions, mismatched initialization,
  update success/failure, local signout, and leaving the recovery route.
- Auth tests cover existing sessions, repeated tab-focus sign-ins, refresh events,
  signout, missing staff authorization, and stale asynchronous profile responses.
- Route tests cover signed-out access, missing profiles, parent accounts,
  admin settings, instructor rejection on admin pages, and root recovery routing.
- TypeScript check passed. Focused lint had no errors and one existing-style Fast
  Refresh export warning in the auth-provider file.
- Build passed with company configuration. A build without configuration failed
  intentionally, confirming there is no silent fallback to Account A.
- Local browser check passed: invalid reset link -> actionable message -> login ->
  forgot-password form. No recovery email or password submission was sent.
- Vercel reports the preview READY, but browser/API inspection is blocked by its
  protection permissions. End-to-end testing against the real company user is NOT
  complete. The company administrator dashboard is NOT verified live.

## Security and Rollout Blockers

The copied database has permissive RLS policies: for example, authenticated users
can modify role assignments and user rows, and some anonymous operations are allowed
on users/enrollments/payments. Frontend route guards are not a database security
boundary. Unauthorized direct API access is NOT fixed by this change. Do not treat
the preview as a production security sign-off. RLS hardening requires a separately
reviewed change and regression checks for registration, payments, and staff scopes.

Dependency audit also reports 36 findings (7 moderate, 27 high, 2 critical); these
need separate triage. No broad or breaking automatic dependency fix was run.

## Next Steps

1. Sign in to Vercel with company access, or authorize the connector for this project
   and team, to inspect the protected preview and its environment settings in the UI.
2. Approve the exact preview recovery redirect in the NEW Supabase project.
3. Request a fresh recovery link for tech@hashtag.dance on the preview. The account
   owner enters the new password privately, then tests login, logout, and reload.
4. After successful authentication, approve running the guarded admin-link script.
   Re-login and verify all administrator modules without making payments or sending
   customer communications.
5. Address the database authorization risks before using the company system live.
6. Only after validation, explicitly approve the main-branch merge, Production
   environment variables, and production deployment. A preview build being READY
   does not authorize promotion.

No Razorpay configuration, webhook, DNS, original-account repository, or original
Supabase project was changed as part of this company authentication task.
