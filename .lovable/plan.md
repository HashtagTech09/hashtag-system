

# Fix Cycle Assignment: No Skipping for Consecutive Same-Type Cycles

## Problem
The current logic in both `isPlanValid` and `computeCycleAssignment` freely skips non-matching cycle types when walking through the calendar. This means "3 Regular Months" starting from April picks April(R), May(R), skips Grid, then July(R) — which is wrong. The plan should only be valid if 3 consecutive calendar cycles are all Regular.

Skipping should only be allowed when the **plan sequence changes type** (e.g., from regular to grid). Consecutive entries of the same type in the sequence must occupy consecutive calendar slots.

## Fix

### Both `isPlanValid` and `computeCycleAssignment` — same logic change

Replace the "skip freely" loop with a stricter rule:
- For the **first** sequence entry, or when the **type changes** from the previous entry, allow skipping non-matching cycles to find the next match.
- For **consecutive same-type** entries in the sequence, the very next calendar cycle must match — no skipping allowed.

```ts
// In isPlanValid and computeCycleAssignment:
let calIdx = startCycleIndex;
let prevType: string | null = null;
for (const seqEntry of sequence) {
  if (prevType === seqEntry.plan_type) {
    // Same type as previous — next calendar cycle MUST match
    if (calIdx >= planCycles.length || planCycles[calIdx].plan_type !== seqEntry.plan_type) {
      return false; // or: plan invalid / not enough cycles
    }
    // matched
    calIdx++;
  } else {
    // Type changed (or first entry) — allow skipping
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
  prevType = seqEntry.plan_type;
}
```

### Result
- **"3 Regular Months"** from April: April(R) ✓, May(R) ✓, next is Grid(G) ✗ → plan **invalid** starting April (correct)
- **"2 Regular + 1 Grid"** from April: April(R) ✓, May(R) ✓, type changes to grid → skip to find Grid ✓ → plan **valid** (correct)

## Files changed
- `src/pages/Enrollments.tsx` — update `isPlanValid` (lines 155-177) and `computeCycleAssignment` (lines 200-213) with the stricter matching logic

## No database changes needed.

