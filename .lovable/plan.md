

# Add "C/F" (Carry Forward) Status to Dashboard

## Problem
When a new plan cycle (month) starts, enrollments from previous cycles that are still active appear with their original status (NEW/REN/REV). This makes it impossible to see how many genuinely new, renewed, or revived enrollments happened in the **current** cycle vs. ones just carrying over.

## Solution
In the Dashboard, classify enrollments into two groups:
- **C/F (Carry Forward)**: Enrollments whose `start_cycle_id` is before the active cycle (i.e., they were created in a previous cycle but their date range overlaps the current one)
- **NEW / REN / REV**: Only enrollments whose `start_cycle_id` matches the active cycle (or were created during the active cycle period)

## Changes — `src/pages/Dashboard.tsx`

1. **Classify enrollments as C/F vs current-cycle**: After fetching enrollments, split them based on whether `start_cycle_id < activeCycle.id` (or `created_at < activeCycle.start_date` as fallback). Mark carry-forwards as `"C/F"` for display purposes.

2. **Add C/F metric card**: New card showing C/F count alongside the existing NEW/REN/REV cards. The C/F card is expandable with per-batch breakdown like the others.

3. **Update Total Dreams**: Total Dreams still shows all enrollments (C/F + current). But the NEW/REN/REV counts only reflect current-cycle enrollments.

4. **Update date-wise breakdown**: C/F enrollments get their own column in the date-wise table. Since C/F enrollments were created in a prior cycle, they won't appear in date rows (they have no "created_at" in this cycle).

5. **Update batch-wise breakdowns**: Add C/F column to the batch table inside Total Dreams expansion.

## Logic
```text
For each enrollment overlapping active cycle:
  if start_cycle_id < activeCycle.id  →  "C/F"
  else                                →  keep original status_type (NEW/REN/REV)
```

If `start_cycle_id` is null, fall back to checking `created_at < activeCycle.start_date`.

## Files changed
- `src/pages/Dashboard.tsx` — add C/F classification logic, new metric card, update batch tables

