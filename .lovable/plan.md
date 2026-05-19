# Exclude removed enrollments from Dashboard counts

## Problem

When an Application Case is approved, the linked enrollment is deactivated
(`is_active = false`). That enrollment is effectively "removed" / withdrawn.

The Dashboard currently counts every enrollment that overlaps the selected
cycle without checking `is_active`, so removed enrollments still inflate:

- Total Dreams
- Head Count
- NEW / REN / REV / C/F splits
- Batch-wise fill and date-wise revenue rows

## Fix

In `src/pages/Dashboard.tsx`, add `.eq("is_active", true)` to the main
`enrollments` fetch (around line 125). Everything downstream
(`classifiedEnrollments`, `totalDreams`, `headCount`, `batchData`,
`headCountData`, `dateWise`) derives from that list, so a single filter
removes withdrawn enrollments from all metrics.

The "renewable" lookback query (line 170) stays as-is — students whose
prior-cycle enrollment was later withdrawn are still validly renewable
candidates from the previous cycle's perspective. (Open to flipping this
too if you'd rather exclude them.)

## Out of scope

- No DB / RLS changes.
- Pending Application Cases badge already filters by `status = 'pending'`,
  so it's unaffected.
- Other pages (Enrollments, Payments, etc.) already show `is_active` state
  via their own UI; not touching them here.
