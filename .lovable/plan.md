## Goal

In the Edit Validity dialog, let admin choose a **plan cycle** (e.g. "Apr 2026", "May 2026") instead of (or in addition to) typing a raw date. The enrollment's `end_date` and `end_cycle_id` both get updated to match the selected cycle.

## UI

The dialog gets a toggle / two-mode picker:

- **By Cycle** (default) — `Select` listing all `plan_cycles` for org 1, sorted by `start_date`. Each option shows `name` + the date range (e.g. *"May 2026 — Apr 5 → May 4"*). Picking one sets `end_date = cycle.end_date` and `end_cycle_id = cycle.id`. The current `end_cycle_id` is preselected.
- **By Date** — the existing raw date input. Saves with `end_cycle_id = null` (so the cycle linkage is cleared when admin overrides with a custom date).

Header shows "Current end: {date} · {current cycle name if any}".

## Data

`plan_cycles` is already fetched on the page (line 88) into existing `planCycles` state — reuse it. No new query needed.

## Save logic

`handleSaveValidity` becomes:

```ts
const update = mode === "cycle"
  ? { end_date: selectedCycle.end_date, end_cycle_id: selectedCycle.id }
  : { end_date: editValidityDate, end_cycle_id: null };
await supabase.from("enrollments").update(update).eq("id", editValidityFor.id);
```

Then refresh the list as today.

## Files

- `src/pages/Enrollments.tsx` only — extend dialog UI, add `validityMode` + `editValidityCycleId` state, update `handleSaveValidity`.

## Non-goals

- No change to `start_date` / `start_cycle_id`.
- No edits to `enrollment_cycles` rows (those track per-cycle ownership and are not the "validity" surface).
- No new DB columns, no migration.
