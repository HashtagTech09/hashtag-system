

# Fix 6-Month Plan Validation: Use Count-Based Matching Instead of Sequence-Based

## Problem
The "5 Regular + 1 Grid" plan (id:7) has its sequence stored as R,R,R,R,R,G — but the actual calendar from April is: April(R), May(R), Grid(G), July(R), Aug(R), Sep(R). The strict sequence matcher requires 5 consecutive regulars before grid, which never exists in the calendar. The plan is incorrectly hidden.

The fundamental issue: the `subscription_plan_cycles` sequence encodes a fixed order (5 regulars then 1 grid), but the real calendar interleaves types differently. Re-ordering the sequence rows would be fragile and break whenever the calendar changes.

## Solution
Replace sequence-based matching with **count-based greedy matching**. Instead of walking the stored sequence entries in order, walk the calendar from `startCycleIndex` and consume cycles by type until the required counts (`total_regular_cycles` and `total_grid_cycles`) are satisfied.

### Logic for both `isPlanValid` and `computeCycleAssignment`:

```text
needed_regular = plan.total_regular_cycles   (e.g. 5)
needed_grid    = plan.total_grid_cycles       (e.g. 1)
total_needed   = needed_regular + needed_grid (e.g. 6)

Walk calendar from startCycleIndex:
  For each calendar cycle:
    if cycle is 'regular' and needed_regular > 0 → assign, decrement needed_regular
    else if cycle is 'grid' and needed_grid > 0 → assign, decrement needed_grid
    else → this cycle type isn't needed, plan can't span past it → INVALID

  If both counts reach 0 → VALID
  If we run out of calendar cycles → INVALID
```

The key rule: every calendar cycle between start and end must be consumed. We don't skip cycles — the student is enrolled for the full contiguous span. If a cycle type appears that isn't needed, the plan doesn't fit.

### Example: "5 Regular + 1 Grid" from April
- April(R) → need regular, consume → 4R + 1G remaining
- May(R) → consume → 3R + 1G remaining  
- Grid(G) → need grid, consume → 3R + 0G remaining
- July(R) → consume → 2R remaining
- Aug(R) → consume → 1R remaining
- Sep(R) → consume → 0R remaining → **VALID** ✓

### Example: "3 Regular Months" from April
- April(R) → consume → 2R remaining
- May(R) → consume → 1R remaining
- Grid(G) → need 0 grid, can't consume → **INVALID** ✗ (correct)

### Example: "2 Regular + 1 Grid" from April
- April(R) → consume → 1R + 1G remaining
- May(R) → consume → 0R + 1G remaining
- Grid(G) → consume → 0R + 0G → **VALID** ✓

## Files changed
- `src/pages/Enrollments.tsx` — rewrite `isPlanValid` and `computeCycleAssignment` to use count-based greedy matching with `total_regular_cycles` / `total_grid_cycles` instead of walking `subscription_plan_cycles` sequence entries

## No database changes needed

