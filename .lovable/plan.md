

# Pricing Overhaul: New Base Prices, Plan-Level Fixed Totals & Flexible Cycle Matching

## What Changes

### 1. New base prices
- Regular cycle: ₹3,200 (was ₹3,767)
- Grid cycle: ₹7,667 (was ₹5,300)

### 2. Plan-level fixed pricing (no visible discount)
Certain subscription plans get hardcoded after-GST totals **per batch**. The discount is baked in but never shown to the user — the fee breakdown just displays the flat per-batch amount.

| Plan | Normal per-batch | Target after GST (1 batch) | Hidden discount |
|------|-----------------|---------------------------|-----------------|
| 5R+1G | ₹23,667 | ₹26,500 | ~5.11% |
| 10R+2G | ₹47,334 | ₹50,000 | ~10.48% |

Back-calculated subtotals: 5R+1G → ₹22,458/batch, 10R+2G → ₹42,373/batch.

For all other plans: compute normally as `R×3200 + G×7667`, round total (after GST) to nearest ₹100.

### 3. Flexible cycle matching (skip non-needed cycles)
Currently a 3R plan fails if a Grid cycle appears in the middle (R, R, **G**, R). The greedy matcher will be updated to **skip** cycle types the plan doesn't need, allowing students to register for e.g. 3 regular months even with a grid break in between.

### 4. Fee breakdown display cleanup
- Update the "Per batch" line to show new prices (₹3,200 / ₹7,667)
- For plans with fixed pricing: show a simple "Plan fee" line instead of the R×price + G×price formula
- Hide multi-batch discount line for fixed-price plans (discount is baked in)
- Multi-batch discounts on top of fixed-price plans still apply normally for 2+ batches

---

## Technical Details

### Files to modify

**`src/lib/enrollmentUtils.ts`**
- Change `REGULAR_PRICE = 3200`, `GRID_PRICE = 7667`
- Add a `PLAN_FIXED_TOTALS` map keyed by `{regularCycles}R{gridCycles}G` → after-GST per-batch total
- `computeFeeBreakdown`: if plan matches a fixed-total key, derive subtotal from the fixed after-GST amount instead of formula; skip discount display fields
- Add `roundToNearest100()` helper for non-fixed plans
- Add `isFixedPricePlan` flag to `FeeBreakdown` interface

**`src/lib/enrollmentUtils.ts` — cycle matching**
- `isPlanValid` and `computeCycleAssignment`: change the `else { return false / break }` to `else { calIdx++; continue }` — skip cycles whose type isn't needed instead of failing

**`src/components/register/FeeBreakdown.tsx`**
- If `breakdown.isFixedPricePlan`, show "Plan fee (5R+1G)" instead of the per-cycle formula
- Hide the multi-batch discount line when `isFixedPricePlan` is true

**`src/components/register/StudentDashboard.tsx`**
- Update hardcoded `3767` / `5300` references (lines 236, 375) to use imported constants
- Plan dropdown preview price: use fixed total when applicable

**`src/lib/styleHierarchy.ts`** — no changes needed

**`supabase/functions/create-razorpay-order/index.ts`** and **`supabase/functions/razorpay-webhook/index.ts`** — no changes needed (they pass through computed amounts)

### Cycle matching fix (pseudocode)
```text
while (neededRegular > 0 || neededGrid > 0) && calIdx < length:
  cycle = planCycles[calIdx]
  if cycle.type == "regular" && neededRegular > 0:
    consume it
  else if cycle.type == "grid" && neededGrid > 0:
    consume it
  else:
    skip (calIdx++) ← was: return false
```

### Fixed pricing math
```text
PLAN_FIXED_TOTALS = {
  "5R1G": 26500,   // after GST, per batch
  "10R2G": 50000,  // after GST, per batch
}

If plan key matches:
  perBatchSubtotal = Math.round(fixedTotal / 1.18)
  For multi-batch: primary = perBatchSubtotal, others = perBatchSubtotal × (1 - multiDiscount)
  GST = total × 0.18 (recalculated)
  Final rounds to nearest 100
```

