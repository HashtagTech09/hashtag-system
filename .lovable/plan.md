

# Add Batch: Plan Selection + Validity Matching for Existing Enrollments

## Problem

Currently, "Add Batch" blindly inherits the reference enrollment's plan and charges only the new batch(es). The user wants:

1. After selecting batch(es) to add, let the student **choose a plan** (like in renew flow)
2. **Match the plan's cycle coverage against existing enrollments** — if the chosen plan covers cycles that existing batches don't have yet, extend those existing enrollments too
3. Price the missing cycles for existing batches at their **positional discounts** (2nd=12%, 3rd=13%, etc.)

### Example

Student has 2 existing batches valid through May. They add 1 new batch and select a plan covering April, May, Grid.

- Existing batch 1 needs Grid cycle → charged at base price (position 1, but since it's a top-up, use base)
- Existing batch 2 needs Grid cycle → charged at 12% discount (position 2)
- New batch 3 needs April + May + Grid → charged at 13% discount (position 3)

**Format**: `[3R + (1G-12%) + (1G-13%)]` — the base cycles already covered are free; only missing cycles are charged with positional discounts.

## Logic

1. **Plan selection step** — Show plan cards in "add" mode (reuse the renew plan selector UI)
2. **Compute cycle assignment** for the selected plan → get matched cycles (e.g., Apr, May, Grid)
3. **Diff against each existing enrollment's cycles** — find which cycles in the new plan are NOT covered by each existing enrollment
4. **Build a combined fee breakdown**:
   - For each existing batch: charge only for missing cycles at their existing positional discount
   - For each new batch: charge the full plan fee at their incremental positional discount
5. **On submit**: 
   - Create enrollments for new batches (as today)
   - Insert `enrollment_cycles` for missing cycles into existing enrollments
   - Update existing enrollment `end_date` / `end_cycle_id` if extended

## Changes

### `src/components/register/StudentDashboard.tsx`

**Add plan selection to "add" mode:**
- In the checkout sub-step for `mode === "add"`, add the same plan card selector currently only shown for renew
- Add state: `addSelectedPlanId`
- Compute cycle assignment from selected plan

**Compute validity-matched fee breakdown:**
- Replace the current `addBatchBreakdown` logic with a new function that:
  1. Gets the selected plan's cycle assignment (matched cycles)
  2. For each active enrollment, queries its `enrollment_cycles` to find which matched cycles are already covered
  3. Computes missing cycles per existing batch
  4. Builds a combined breakdown:
     - Position 1 (primary existing batch): missing cycles at base price
     - Position 2+ (other existing batches): missing cycles at positional discount
     - Position N+1+ (new batches): full plan cycles at positional discount

**Update `handleAddBatch`:**
- Create enrollments for new batches with the selected plan's dates
- For existing enrollments with missing cycles: insert additional `enrollment_cycles` rows and update the enrollment's `end_date`/`end_cycle_id` if needed

### `src/lib/enrollmentUtils.ts`

Add a helper function `computeAddBatchBreakdown` that takes:
- `existingEnrollments` (with their covered cycle IDs)
- `newBatchCount`
- `plan` (selected SubPlan)
- `planCycles` (calendar)
- `startCycleIndex`

Returns a breakdown with per-batch allocations showing:
- Existing batches: only missing cycle fees with positional discount
- New batches: full plan fee with positional discount

## Files changed
- `src/lib/enrollmentUtils.ts` — add `computeAddBatchBreakdown` helper
- `src/components/register/StudentDashboard.tsx` — add plan selector to "add" mode, replace fee logic, update submit handler to extend existing enrollments

