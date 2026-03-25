

# Complete Fee Calculation with Cycle-Based Pricing, Discounts, and GST

## Overview
Replace the current flat `pricing_plans` lookup with a cycle-type-based fee system. Fees depend on how many Regular (R) and Grid (G) cycles the subscription spans, with multi-batch discounts, drop-in adjustments, and 18% GST.

## Current vs New Pricing

**Current**: Looks up `pricing_plans` table by `batch_count` → single flat fee.
**New**: `(R_cycles × ₹3,220) + (G_cycles × ₹7,000)` per batch, with percentage discount by batch count.

## Fee Calculation Logic

### Per-Batch Base Fee
When a subscription plan is selected, count matched Regular and Grid cycles:
```
per_batch_fee = (regular_count × 3220) + (grid_count × 7000)
```
If no subscription plan selected, fall back to single regular cycle: `per_batch_fee = 3220`.

### Multi-Batch Discount
| Batches | Discount |
|---------|----------|
| 1       | 0%       |
| 2       | 12%      |
| 3       | 13%      |
| 4       | 14%      |
| 5+      | 15%      |

### Scenario Detection
- **Fresh**: Student has no active enrollments (status NEW, REV, or REN-late)
- **Upgrade**: Student has active enrollments (status REN, `today <= latest_end_date`) — *defer upgrade flow to future iteration*

### Fresh Flow
```
discounted_per_batch = per_batch_fee × (1 - discount%)
total_batch_fee = discounted_per_batch × batch_count
drop_in_adj = eligible drop-in amount (if style matches)
subtotal = total_batch_fee + reg_fee - drop_in_adj
final = subtotal × 1.18  (GST)
```

### Upgrade Flow (Future)
Mark as a separate phase — requires extending old enrollments, splitting discount logic. For now, show a note "Upgrade pricing coming soon" if REN-active student detected.

### Registration Fee
Same as current: ₹500 for NEW/REV/REN-late, ₹0 for REN-active.

## Changes to `src/pages/Enrollments.tsx`

### `computeFeeBreakdown()`
1. Count R and G cycles from the matched cycles in `computeCycleAssignment` (store in form state: `regular_cycles`, `grid_cycles`)
2. Calculate `per_batch_fee = (regular_cycles × 3220) + (grid_cycles × 7000)`
3. Look up discount by `batch_count`
4. Apply discount to get `discounted_per_batch`
5. Compute `total_batch_fee = discounted_per_batch × batch_count`
6. Add reg fee, subtract drop-in
7. Apply 18% GST
8. Return full breakdown for display

### Form state additions
Add `regular_cycles: number` and `grid_cycles: number` — set during `computeCycleAssignment`. Default to `{regular: 1, grid: 0}` when no plan selected.

### `handleEnroll()`
Use same cycle-based calculation instead of `pricing_plans` lookup.

### Fee Breakdown UI
Update the breakdown card to show:
- Per-batch fee (R × ₹3,220 + G × ₹7,000)
- Discount (X% for N batches)
- Batch total after discount
- Registration fee
- Drop-in adjustment
- Subtotal
- GST (18%)
- **Final Amount**

### `pricing_plans` table
Keep for reference but no longer used in enrollment calculation. No migration needed.

## Summary
1. **Form state**: Add `regular_cycles`, `grid_cycles` fields
2. **computeCycleAssignment**: Count R/G cycles from matched cycles, store in form
3. **computeFeeBreakdown**: New cycle-based formula with discount tiers + GST
4. **handleEnroll**: Use new formula for payment amount
5. **UI**: Enhanced breakdown showing per-batch, discount, GST lines

