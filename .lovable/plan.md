## Problem

`TestDateContext` fetches `system_settings.test_mode` once on mount. When the admin toggles test mode in Settings, the Enrollments page still thinks `isTestMode = false`, so the "Edit Validity" and "Delete Enrollment" dropdown items (and the amber banner) never appear without a hard refresh.

## Fix

Make `src/contexts/TestDateContext.tsx` reactive:

1. **Expose `refresh()`** from the context so any consumer can force a re-read.
2. **Re-fetch on window focus** (`visibilitychange` + `focus` listeners) — covers the common case of toggling in another tab/panel and coming back.
3. **Listen to a custom `test-mode-changed` window event** and re-fetch when it fires.
4. **Dispatch `test-mode-changed`** from the Settings toggle handler right after the DB update succeeds, so same-tab toggles take effect instantly.
5. **Subscribe to Supabase Realtime** on `system_settings` filtered to `key=test_mode, organization_id=1` as a belt-and-suspenders update channel.

No changes to `Enrollments.tsx` itself — it already gates correctly on `isTestMode && isAdminOrManager`.

## Files

- `src/contexts/TestDateContext.tsx` — add `refresh`, focus/visibility listeners, custom-event listener, realtime subscription.
- Settings page that toggles `test_mode` (need to locate — likely `src/pages/Settings.tsx` or a Communications/Testing settings component) — dispatch `window.dispatchEvent(new Event("test-mode-changed"))` after the update.

## Non-goals

- No schema changes, no new RLS, no changes to the Enrollments dropdown code.
- Not touching the simulated-date logic — only the `isTestMode` flag flow.
