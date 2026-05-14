## Problem

The "Application Case" button is rendered in the rightmost **Actions** column of the Enrollments table (`src/pages/Enrollments.tsx`, lines 927–944). With 12 columns at a 981px viewport, the table overflows horizontally and the Actions column is clipped off-screen, so it looks like the option doesn't exist.

## Fix

Make the action reliably reachable regardless of table width by switching from a trailing column to an inline row menu.

### Changes (UI only, `src/pages/Enrollments.tsx`)

1. **Remove the standalone "Actions" `<TableHead>` and `<TableCell>`** at the end of each row.
2. **Add a compact actions trigger to the `#` (index) cell** — a small kebab/`MoreVertical` icon button next to the row number, always visible (no horizontal scroll required).
3. The icon opens a `DropdownMenu` containing:
   - **Request Application Case** (managers + admins) — opens the existing dialog.
   - If a pending case already exists for that enrollment, show a disabled item labeled **"Pending Case (awaiting approval)"** instead.
4. Keep the existing dialog, submit handler, `pendingCases` map, and role gating untouched.
5. Adjust `colSpan` on the empty-state row from `isAdminOrManager ? 12 : 11` to a single value (11) since the trailing column is gone.

### Out of scope

- No changes to data fetching, `application_cases` schema, approval flow, or `ApplicationCases.tsx`.
- No new routes or backend changes.

## Result

Every enrollment row gets a visible kebab button at the far left, so managers/admins can request an Application Case without scrolling horizontally. The button currently being clipped on the right is removed.
