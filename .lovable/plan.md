# Fix: Dashboard counts students in cycles they don't actually own

## The bug

On `/` (Dashboard), when you switch the cycle dropdown to a Grid month, students who bought a Regular-only plan (e.g. Anannya Agarwal's "3 Regular Months: May'26 → Aug'26", batch `HipHop1-NDA`) appear in the count.

Anannya owns 3 **regular** cycles only. She does not own any grid cycle. But because her enrollment's `start_date`/`end_date` window (Apr 27 → Aug end) overlaps the grid month sitting in between, the dashboard pulls her into that cycle's totals.

## Root cause

`src/pages/Dashboard.tsx` (lines 128–136) selects enrollments using **date-range overlap** against the selected cycle:

```text
enrollments.is_active = true
  AND end_date   >= selectedCycle.start_date
  AND start_date <= selectedCycle.end_date
```

This is wrong for two reasons:

1. A Regular-only plan can span calendar months that include a Grid cycle. Date overlap includes that grid month even though the student bought 0 grid cycles.
2. The source of truth for "which cycles does this enrollment cover" is the `enrollment_cycles` table (with `cycle_adjustments` applied on top), not the enrollment's start/end dates.

The downstream metrics — Total Dreams, Head Count, batch-wise, NEW/REN/REV/CF buckets — all flow from this one query, so the over-count propagates everywhere.

## Fix

Change the enrollment fetch in the Dashboard so an enrollment is included for `selectedCycle` only when the student actually owns that cycle for that batch.

Steps:

1. Keep the existing date-window query as a coarse pre-filter (cheap, narrows the set).
2. Then fetch `enrollment_cycles` rows for those `enrollment_id`s where `cycle_id = selectedCycle.id`.
3. Also fetch `cycle_adjustments` (status `APPLIED`) for the same `student_id` + `batch_id` set, and apply the same shift-in / shift-out logic already used by `getEffectiveCycles` in `src/lib/cycleUtils.ts`.
4. Keep only enrollments whose effective cycles for that student+batch include `selectedCycle.id`.

After that filter, every existing metric (`totalDreams`, `headCount`, `batchData`, `headCountData`, `dateWise`, `cfDreams`, `newDreams`, `revDreams`, `renDreams`, popup contents) recomputes correctly with no further changes.

## Scope

- Edit: `src/pages/Dashboard.tsx` only (the `fetchData` effect around lines 102–215, plus a small helper for the cycle-ownership filter).
- Reuse: `getEffectiveCycles` from `src/lib/cycleUtils.ts`.
- No schema changes. No changes to renewals, payments, or drop-ins logic.
- The "renewable" count (line 174–183) is already a separate query keyed on `end_date` in the grace window — it stays as-is.

## Out of scope

- Re-deriving status (NEW/REN/REV/CF) — only the membership question changes.
- Other pages (`Enrollments`, `Analytics`, exports). If the user reports the same symptom elsewhere we can fix those next.
- Backfilling `enrollment_cycles` for legacy enrollments. If any active enrollment is missing `enrollment_cycles` rows, it will disappear from per-cycle counts — we should spot-check this before shipping (see Verify).

## Verify

- Open Dashboard, pick the grid cycle that sits inside Anannya's May→Aug window. She should no longer appear in Head Count or in the `HipHop1-NDA` row.
- Pick a regular cycle she does own (e.g. May'26). She should still appear.
- Spot-check totals against `enrollment_cycles` for one batch in one cycle:
  `count(distinct student_id) where cycle_id = X and batch_id = Y` should match the Head Count cell.
