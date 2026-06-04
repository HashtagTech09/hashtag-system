## Goal

Fix the `duplicate key value violates unique constraint "enrollment_cycles_student_id_batch_id_cycle_id_key"` error from "Edit validity", and prevent users from creating ambiguous overlapping enrollments going forward.

## Two changes

### 1. Skip-on-conflict in `handleSaveValidity`

In `src/pages/Enrollments.tsx`, inside the reconciliation block of `handleSaveValidity` (right before the insert step):

- Build `toInsertIds = toInsert.map(pc => pc.id)`.
- Query existing rows for the same `(student_id, batch_id)` filtered by those cycle ids:
  ```ts
  const { data: ownedElsewhere } = await supabase.from("enrollment_cycles")
    .select("cycle_id")
    .eq("student_id", e.student_id)
    .eq("batch_id", e.batch_id)
    .in("cycle_id", toInsertIds);
  ```
- Skip any cycle id present in that result. Only insert the remainder.
- Toast logic: if some were skipped, surface a soft warning chip in the success toast — `"Validity updated (N cycle(s) already covered by another enrollment, left as-is)"`. Hard failures stay as the existing error toast.

This removes the error. Dashboard visibility is preserved because the cycle is already owned by the other enrollment.

### 2. Pre-save overlap warning

Before submitting the update in `handleSaveValidity`, compute whether the new `[start_cycle_id .. resolvedEndCycle.id]` window overlaps with another **active** enrollment for the same `(student_id, batch_id)`:

- Query `enrollments` where `student_id = e.student_id AND batch_id = e.batch_id AND id <> e.id AND is_active = true`.
- For each such row, check if its `[start_cycle_id, end_cycle_id]` window (resolved via `planCycles` ordering) overlaps the new window.
- If yes, show a confirm dialog before saving: `"This validity overlaps with enrollment #XXX on the same batch (covers <range>). Months already covered by that enrollment will stay attributed to it. Continue?"` with Cancel / Continue buttons.

If the user clicks Continue, the save proceeds with the skip-on-conflict path from step 1. If Cancel, abort.

Implementation note: reuse the existing `AlertDialog` import. Add a small local state `overlapWarning: { ranges: string[]; onConfirm: () => void } | null` and gate the actual save behind it.

## Files changed

- `src/pages/Enrollments.tsx` — extend `handleSaveValidity` only. No new files, no schema change, no migration.

## Out of scope

- Dropping or changing the `enrollment_cycles_student_id_batch_id_cycle_id_key` unique constraint. The constraint is doing useful work — keep it.
- Transferring ownership on overlap. Stays with the prior enrollment, matching current data.
- Adding the same overlap guard to the original "create enrollment" flow. The dialog has its own gap-detection (`detectedStatus`, `latestEndDate`) that already nudges users toward REN/REV — separate concern, do it as a follow-up if needed.
- Backfilling existing overlap conflicts (none reported beyond the one toast).

## Verification

1. Reproduce the original case: edit validity to extend into months already covered by another enrollment for the same batch → confirm dialog appears, user confirms → save succeeds, no error toast, message says "N already covered". Dashboard for those months still shows the student (attributed to the older enrollment).
2. Edit validity to extend into a window with no other coverage → no dialog, save succeeds, new `enrollment_cycles` rows created.
3. Shorten validity → unchanged behavior; stale rows deleted as before.
4. Edit validity where the new window doesn't overlap any other enrollment → no warning, no skips, clean toast.
