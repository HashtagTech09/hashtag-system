## Real bug

`TestDateProvider` is only wrapped around `src/pages/Register.tsx`. The admin app (`Enrollments`, `Settings`, etc.) is **not** inside the provider, so `useTestDate()` returns the default value `{ isTestMode: false }` everywhere except the public Register page. The amber banner and admin "Edit Validity"/"Delete Enrollment" items can never appear regardless of the DB value or the Settings toggle.

## Fix

Wrap the whole app with `TestDateProvider` in `src/App.tsx`, placed just inside `AuthProvider` so all routes (including admin pages) can read the flag.

```
<AuthProvider>
  <TestDateProvider>
    {/* existing routes */}
  </TestDateProvider>
</AuthProvider>
```

Remove the now-redundant `<TestDateProvider>` wrapping in `src/pages/Register.tsx` (keep its `useTestDate` usage — it will resolve to the app-level provider).

## Files

- `src/App.tsx` — import `TestDateProvider`, wrap routes.
- `src/pages/Register.tsx` — drop the local `TestDateProvider` wrapper, keep the import for `useTestDate`.

## Non-goals

- No changes to `TestDateContext.tsx` (the reactivity work from the previous turn stays).
- No changes to `Enrollments.tsx` or `Settings.tsx`.
