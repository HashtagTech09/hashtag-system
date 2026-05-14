## Plan

1. **Show the logged-in staff account in the Staff Portal header**
   - Add the current staff name/email and role badges to the top header, next to the page title.
   - If the logged-in auth account has no matching staff record, show a clear fallback like “Signed in: <email> · No staff profile”.

2. **Explain why the Application Case button may be missing**
   - The current Enrollments page only shows the Application Case menu when `isAdminOrManager` is true.
   - Showing the logged-in staff role will make it immediately clear if the account is not admin/manager.

3. **Make the Application Case action easier to find**
   - Keep the existing kebab menu in the `#` column.
   - Add accessible tooltip/label text so the icon is understandable.
   - Optionally show a small “Application Case” text button for admin/manager rows instead of only the icon, if space allows.

## Technical details

- Update `src/components/AdminLayout.tsx` to read `user`, `staffUser`, and `staffRoles` from `useAuth()` and render account identity in the header.
- Update `src/pages/Enrollments.tsx` so the action trigger has a visible label or tooltip and remains gated to admin/manager accounts.
- No database changes are needed.