

# Fix Plan Validation Logic and Add Per-Plan Fee Preview

## Problem

### 1. `isPlanValid` is too restrictive
The current logic only looks at a strict window of exactly `totalRequired` consecutive cycles. For example, plan "2 Regular + 1 Grid" (total_cycles=3) only checks cycles[2..4] = March(R), April(R), May(R) — finds no grid cycle and marks it invalid.

But `computeCycleAssignment` uses a different strategy: it walks forward and **skips** non-matching cycle types. So plan 6 would successfully match March(R), April(R), then skip May(R) to find Grid'26(G). The validation and assignment logic are inconsistent.

**Result**: Plans like "2 Regular + 1 Grid" don't appear in the dropdown even though they can be assigned.

### 2. No per-plan fee preview
There's no way to see what each plan costs before selecting it. The fee breakdown only shows after selecting batches + plan.

## Fix

### 1. Rewrite `isPlanValid` to mirror `computeCycleAssignment` logic
Instead of a strict window, walk through calendar cycles the same way assignment does — skip non-matching types:

```ts
const isPlanValid = (plan: any): boolean => {
  const sequence = subPlanCycles
    .filter(s => s.subscription_plan_id === plan.id)
    .sort((a, b) => a.sequence_order - b.sequence_order);
  if (sequence.length === 0) return false;

  let calIdx = startCycleIndex;
  for (const seqEntry of sequence) {
    let found = false;
    while (calIdx < planCycles.length) {
      if (planCycles[calIdx].plan_type === seqEntry.plan_type) {
        calIdx++;
        found = true;
        break;
      }
      calIdx++;
    }
    if (!found) return false;
  }
  return true;
};
```

### 2. Show per-plan fee in the plan dropdown
In the `SelectItem` for each valid plan, append the per-batch fee:

```
"2 Regular + 1 Grid — ₹12,834/batch"
```

Computed as: `(plan.total_regular_cycles * 3767) + (plan.total_grid_cycles * 5300)`.

## Files changed
- `src/pages/Enrollments.tsx` — rewrite `isPlanValid`, update plan dropdown labels

## No database changes needed.

