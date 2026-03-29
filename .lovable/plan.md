

# Fix Enrollment Fee Display and Subscription Plan Defaults

## Problem
1. **Fee breakdown display shows old prices**: Line 533 hardcodes the display text as `₹3,220` and `₹7,000` but the actual calculation (line 231) uses the updated `₹3,767` and `₹5,300`. This makes the displayed breakdown misleading.
2. **Default cycles when no plan selected**: When no subscription plan is chosen, `regular_cycles` defaults to `1` and `grid_cycles` to `0`, which may not match what the admin expects.

## Fix — `src/pages/Enrollments.tsx`

1. **Update fee breakdown display text** (line 533): Change `₹3,220` → `₹3,767` and `₹7,000` → `₹5,300` so the label matches the actual calculation.

2. **Auto-select the first valid subscription plan** when the enrollment dialog opens (or when student changes), so the cycle composition and fees are always correct by default instead of falling back to `regular_cycles: 1, grid_cycles: 0`.

   Add a `useEffect` that watches `validPlans` and `dialogOpen` — if `form.subscription_plan_id` is empty and there are valid plans, auto-call `computeCycleAssignment` with the first valid plan.

No database changes needed.

