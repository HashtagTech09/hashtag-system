## Goal

Stop silently creating a second active enrollment for a student when one already overlaps. Make the operator declare intent: **Keep both** (multi-batch), **Replace** (deactivate prior overlapping enrollment), or **Cancel**.

Applies to two flows only: **CSV Import** and **Admin Enrollments → Add Enrollment**. Add-Batch flow, online signup (Razorpay webhook), and the existing Change-Batch flow are out of scope.

## Overlap definition

For a candidate insert `(student_id, new_batch_id, new_start_date, new_end_date)`, fetch all `enrollments` rows where:
- `student_id = candidate.student_id`
- `is_active = true`
- `batch_id <> new_batch_id`
- date ranges overlap: `existing.start_date <= new_end_date AND existing.end_date >= new_start_date`

Any matching row is a "conflicting enrollment."

## Flow 1 — Admin "Add Enrollment" (`src/pages/Enrollments.tsx`)

In `handleSave` (around line 568), **before** inserting the new enrollment records:

1. For each `batchId` in `form.batch_ids`, run the overlap query above against the form's `startDate`/`endDate`.
2. If any conflicts exist, halt the save and open a new `AlertDialog` listing them:
   ```
   {Student} already has active enrollment(s) overlapping this period:
     • Kids Ballet  (2026-03-30 → 2027-05-16)
     • Hip Hop 1    (2026-04-01 → 2026-09-30)
   
   [Keep both]   [Replace previous]   [Cancel]
   ```
3. Branches:
   - **Cancel** → abort, no DB writes.
   - **Keep both** → proceed with original insert path unchanged.
   - **Replace previous** → in a sequenced step, update each conflicting enrollment with `{ is_active: false }` (no other fields touched, no cycles/payments deleted), then proceed with the insert.
4. Per-batch conflicts are aggregated into one dialog (don't open multiple dialogs sequentially).

State: add `overlapConflicts: { enrollments: ConflictRow[]; onResolve: (action: 'keep'|'replace'|'cancel') => void } | null`. Renders existing `AlertDialog` pattern (already used for the validity-save warning).

## Flow 2 — CSV Import (`src/pages/Import.tsx`)

Import processes many rows in a loop; per-row modal prompts are not viable. Two-stage approach:

**Stage A — pre-flight scan (before any inserts):**
1. After student lookup/creation but before the insert loop (around line 416), compute all candidate `(student_id, batch_id, start_date, end_date)` tuples from rows.
2. Batch-fetch active enrollments for those student_ids and check overlaps in memory.
3. Collect conflicts into a list: `{ rowIndex, student, newBatch, conflictingEnrollments[] }`.

**Stage B — single resolution dialog (if conflicts found):**
Open a dialog before any insert runs:
```
{N} of {total} rows would create an additional active enrollment for a
student who already has an overlapping one. How should these be handled?

  ( ) Keep both     — import as-is (current behavior)
  ( ) Replace       — deactivate the prior overlapping enrollment, then import
  ( ) Skip          — do not import these rows (others proceed)
  ( ) Cancel import — abort entirely

[Show details ▾]   lists the {N} rows with student name, old batch, new batch, dates
```
- **Keep both** → existing flow.
- **Replace** → for each conflict row, set `is_active = false` on the listed prior enrollments, then insert the new one.
- **Skip** → drop those rows from the insert loop; record them in `errorMessages` as "Skipped (overlap)".
- **Cancel import** → abort, no inserts, no deactivations.

Resolution applies once to all conflicts in the batch (no per-row prompts). The summary at the end of import already shows `success`/`errors`/`errorMessages`; extend it with a `skipped` and `deactivated` count.

## Out of scope

- Razorpay webhook / online signup flow.
- Add-Batch flow (intentional multi-batch).
- Existing Change-Batch dialog (already mutates in place).
- Backfilling historical duplicates (Kaira-style records left as-is per user direction).
- Schema changes — no new columns, no migration.

## Verification

1. Admin: create an enrollment for a student who already has an overlapping active one → dialog appears. Test each of the three branches.
2. Admin: create an enrollment for a student with no overlap → no dialog, saves as before.
3. Import: upload a CSV containing one new row that overlaps an existing enrollment → resolution dialog appears with row count = 1. Test all four branches.
4. Import: upload a CSV with no overlaps → no dialog, imports as before.
5. After "Replace" in either flow, confirm: prior enrollment row has `is_active = false`, its `enrollment_cycles` rows untouched, new enrollment is the only active row for that student+batch combination.

## Files touched

- `src/pages/Enrollments.tsx` — overlap check + AlertDialog in `handleSave`.
- `src/pages/Import.tsx` — pre-flight scan + resolution dialog + branching in the enrollments import step.

No new files, no edge-function changes, no migration.
