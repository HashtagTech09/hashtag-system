

# Validity Display Improvements + Existing Batch Details

## Problem
1. Validity shows cycle names like "April'26 → July'26" but should show the **actual last date** (e.g., "1 Apr 2026 → 31 Jul 2026")
2. If a plan has **gaps** (e.g., Grid cycle in between that the student is NOT valid for), those gaps should be shown
3. Existing batches in the "Add Batch" checkout view only show batch name — should also show **batch_code** and **studio**

## Changes

### `src/components/register/StudentDashboard.tsx`

**1. Validity dates — show actual end_date instead of cycle name**

All validity displays currently use `assignment.startCycle.name → assignment.endCycle.name`. Replace with formatted actual dates from `start_date` and `end_date`:
- Line 518: Active enrollment dates `e.start_date → e.end_date` → format as `"1 Apr'26 → 31 Jul'26"`
- Line 536: Past enrollment dates — same formatting
- Line 641: Batch card "Active till" badge — format `existingEnrollment.end_date` as `"31 Jul'26"`
- Line 722: Renew plan validity box — show `assignment.startCycle.start_date` → `assignment.endCycle.end_date` formatted
- Line 786: Add plan validity box — same

Add a small helper `formatDate(dateStr)` that converts `"2026-07-31"` → `"31 Jul'26"`.

**2. Show gaps in plan validity**

When showing the validity box (lines 720-724 and 784-788), examine `assignment.matched` cycles. If there are calendar cycles between the start and end that are NOT in `matched`, list them as gaps:
- e.g., "Not valid: Grid'26 (15 Jun → 30 Jun)"
- Walk through `planCycles` from `startCycle` to `endCycle`, find any cycle NOT in `matched`, show it as a gap with its date range

**3. Existing batches in Add checkout — show batch_code + studio**

Lines 751-755: Replace the simple Badge list with more detailed display showing:
- Batch name + batch_code
- Studio name (look up from `studios` array using `e.batches?.studio_id`)

Also in the add breakdown per-batch line items (lines 808-821), show batch_code alongside batch_name for existing batches.

## Files changed
- `src/components/register/StudentDashboard.tsx` — date formatting helper, gap detection, existing batch details

