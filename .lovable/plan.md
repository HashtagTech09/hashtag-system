## Goal
Let admins manage enrollments more freely while testing: delete an enrollment, change its validity (end date), and continue adding via the existing flows — but **only when Test Mode is ON**, to prevent accidental destructive changes in production data.

## Scope
Page: `src/pages/Enrollments.tsx` (+ one migration for the DELETE policy).

"Add" is already available today via the **+ New Enrollment** and **Add Batch** buttons at the top of the page. No new add flow needed — the existing ones already work for admins. This plan covers the two missing capabilities (delete, change validity) and gates everything behind test mode.

## Changes

### 1. Gate by Test Mode + Admin
- Import `useTestDate` from `@/contexts/TestDateContext`.
- In the row dropdown (currently shows only "Request Application Case"), show the new actions only when `isAdminOrManager && isTestMode`.
- Outside test mode the row menu stays exactly as today.

### 2. Row dropdown — new items
Add two items below the existing "Request Application Case":

- **Edit Validity** — opens a small dialog with a date input pre-filled to `e.end_date`. On save, updates `enrollments.end_date` for that row.
- **Delete Enrollment** — opens an AlertDialog confirmation. On confirm:
  1. `DELETE FROM enrollment_cycles WHERE enrollment_id = e.id`
  2. `DELETE FROM payment_allocations WHERE batch_id = e.batch_id AND payment_id = e.payment_id` (only the allocation for this enrollment row)
  3. `DELETE FROM enrollments WHERE id = e.id`
  Toast on success, `fetchData()` to refresh.

Both actions are visually marked (Edit Validity uses default styling, Delete uses `text-destructive`).

### 3. Test-mode banner
At the top of the page, when `isTestMode`, show a small amber pill: "Test mode — destructive enrollment actions enabled." So it's obvious why the extra buttons appeared.

### 4. Database — enable DELETE
`enrollments` and `enrollment_cycles` currently have no DELETE policy for `authenticated`. Add via migration:

```sql
CREATE POLICY "Allow delete enrollments" ON public.enrollments
  FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow delete enrollment_cycles" ON public.enrollment_cycles
  FOR DELETE TO authenticated USING (true);
```

`payment_allocations` already has a DELETE policy for authenticated — no change needed.

## Non-goals
- No changes to payments (we keep the payment record; only remove the allocation for the deleted batch row).
- No bulk delete, no undo.
- No edits to `start_date`, plan, cycles, or batch — only `end_date` (validity).
- No new "add" UI — existing **+ New Enrollment** / **Add Batch** buttons cover it.

## Technical notes
- Reuse existing `AlertDialog`, `Dialog`, `Input[type=date]` primitives.
- Use `supabase.from("enrollments").update({ end_date }).eq("id", e.id)` for validity edit.
- Read `isTestMode` from `useTestDate()` (already used elsewhere in the app).
