## Goal

Make "Edit validity" on `/enrollments` keep `enrollment_cycles` in sync with the new end date, so the dashboard and the `/enrollments` month filter always agree with what the enrollment row says.

## Current behavior (bug)

`handleSaveValidity` in `src/pages/Enrollments.tsx` (L151–170) updates only `enrollments.end_date` and `enrollments.end_cycle_id`. It never touches `enrollment_cycles`. Result:

- **Shorten**: leftover `enrollment_cycles` rows past the new end-cycle keep the student visible on the dashboard for months they shouldn't be in.
- **Extend (date mode)**: no rows added, student missing from dashboard for the new tail months.
- **Extend (cycle mode)**: same — new cycles in the extended range get no `enrollment_cycles` rows.

## Fix

Reconcile `enrollment_cycles` for the edited enrollment to exactly cover `[start_cycle_id, end_cycle_id]` after the update.

Steps inside `handleSaveValidity`, after the existing `enrollments.update(...)` succeeds:

1. **Resolve the new end-cycle row.** In `cycle` mode, we already have `c`. In `date` mode, `end_cycle_id` is set to `null`, so derive an effective end cycle by finding the latest `planCycles` row with `start_date <= update.end_date`. If none, skip the sync and toast a warning ("Validity saved, cycle coverage not adjusted"). The enrollment's own `start_cycle_id` defines the lower bound.

2. **Compute the target cycle id set.** Take `planCycles` sorted by `start_date`, slice from the index of `start_cycle_id` to the index of the resolved end cycle inclusive. That's `targetCycleIds`.

3. **Read current rows.** `select cycle_id from enrollment_cycles where enrollment_id = e.id`.

4. **Delete stale rows.** Any current `cycle_id` not in `targetCycleIds` → delete.

5. **Insert missing rows.** Any `cycle_id` in `targetCycleIds` not currently present → insert with `enrollment_id`, `student_id`, `batch_id`, `cycle_id`, `cycle_type` (use `planCycles[i].plan_type`).

6. **Skip-out adjustments.** Do not delete `enrollment_cycles` rows whose `cycle_id` appears as a `cycle_adjustments.new_cycle_id` (status APPLIED) for this `(student_id, batch_id)` — those were shifted in deliberately and aren't part of the contiguous template.
   Simplest implementation: before step 4, fetch `cycle_adjustments` for the enrollment's `(student_id, batch_id)` with status APPLIED, build a `keepIds` set of `new_cycle_id`s, and treat `targetCycleIds ∪ keepIds` as the protected set in the delete step. The insert step still only inserts the contiguous template.

7. **Error handling.** If either the delete or insert fails, toast `"Validity saved, but cycle coverage failed to update"`. Don't roll back the enrollment update — it's still correct.

8. **No backfill migration needed.** Existing enrollments whose validity was previously edited may already be out of sync; flag this as a follow-up if the user wants a one-shot reconciliation script.

## Files changed

- `src/pages/Enrollments.tsx` — extend `handleSaveValidity` only. No new files, no new helpers needed (logic is local to one handler and uses already-loaded `planCycles`).

## Out of scope

- The retroactive backfill for previously-edited validities.
- Any change to other handlers (`handleChangeBatch`, `handleDeleteEnrollment`) — they already maintain `enrollment_cycles`.
- Date-mode UX — we keep it but it stays a soft path; the cycle picker remains the recommended way.

## Verification

1. Take an active enrollment ending in May'26. Edit validity → pick Mar'26 cycle. Open dashboard for Apr'26 / May'26 → student no longer appears. Open Feb'26 → still appears.
2. Take an enrollment ending in Feb'26. Edit validity → pick May'26. Dashboard for Mar/Apr/May'26 now lists the student.
3. Take an enrollment with an APPLIED `cycle_adjustment` that shifted a cycle IN (e.g., Jul'26). Shorten validity to Apr'26 → Jul'26 access is preserved (its `enrollment_cycles` row is not deleted).
4. With no month picked, `/enrollments` list still shows the enrollment with its updated end date.
