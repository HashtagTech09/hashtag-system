## Goal

In the Enrollments page, let admin change the **batch** of an existing enrollment via a new dropdown action — useful for fixing wrong selections or moving a student between batches mid-validity.

## UI

- New dropdown item **"Change Batch"** in the row menu (between *Edit Validity* and *Delete Enrollment*), gated on `isAdminOrManager` like the others.
- Opens a dialog with:
  - Read-only header: Student name, current batch (`batch_code · name`), validity range.
  - **From Batch** (read-only) and **To Batch** `Select` listing all `batches` for org 1, grouped/labelled by studio, current batch excluded.
  - Optional **Reason** textarea (not persisted — just acknowledged in toast for now).
  - Footer: Cancel / Save.

## Save logic

On Save:
```ts
await supabase.from("enrollments").update({ batch_id: newBatchId }).eq("id", e.id);
await supabase.from("enrollment_cycles").update({ batch_id: newBatchId }).eq("enrollment_id", e.id);
```
Then `fetchData()` to refresh.

## Out of scope (intentionally)

- No re-pricing, no payment refund/rebalance. `payment_allocations` is **not** touched — those reflect what was actually paid for and stay historically accurate.
- No automatic attendance migration, no session regeneration.
- No new DB columns, no migration.
- `previous_batch_id` is **not** rewritten (it tracks renewal lineage, not admin edits).

## Files

- `src/pages/Enrollments.tsx` only — new state (`changeBatchFor`, `changeBatchToId`), new `handleChangeBatch`, new dropdown item, new dialog.