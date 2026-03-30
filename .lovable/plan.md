

# Force Grid-Inclusive Plans When Grid Is Upcoming

## Problem
When a student's Regular-only plan ends just before a Grid month, the system should not offer pure-Regular plans that can't fit. The user wants to **force plan upgrade** — only show plans that include Grid when Grid is the next non-Regular cycle.

Grid-only renewals use the same grace_days logic (already works with current `registration_deadline` system).

## Current Behavior
`isPlanValid` already filters out plans whose sequence can't map to upcoming calendar cycles. So "3 Regular Months" is already hidden if 3 consecutive Regular months don't exist from `startCycleIndex`. This means **the filtering is already correct** after the previous fix.

## What's Actually Needed
No code change is required for the "force plan upgrade" behavior — it's already implemented:

1. `isPlanValid` with the strict consecutive-same-type rule already rejects "3 Regular Months" when a Grid cycle interrupts the sequence.
2. Only plans like "2 Regular + 1 Grid" (which can map across the Grid gap) will appear as valid.
3. Grid-only plans use the same `registration_deadline` = `start_date + grace_days`, which is already set by the trigger.

## Verification
The system should already show only Grid-inclusive plans when enrolling today (March 29):
- Start cycle = April (Regular)
- April(R), May(R), Grid(G) — "3 Regular" fails, "2 Regular + 1 Grid" passes
- This is the correct "force plan upgrade" behavior

**No code or database changes needed** — the existing `isPlanValid` logic with the strict same-type consecutive rule already forces this behavior. The user just needs to verify by opening the enrollment dialog.

