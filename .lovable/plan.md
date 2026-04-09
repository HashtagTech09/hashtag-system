

# Waive Registration Fee for Fixed-Price Plans (5R1G / 10R2G)

## Problem
The 5R1G and 10R2G plans should never charge a registration fee (₹424 base / ₹500 after GST), regardless of student status (NEW, REN, Late REN, REV). Currently the code applies the reg fee based solely on status.

## Changes

### `src/lib/enrollmentUtils.ts`
In `computeFeeBreakdown`, after computing `applyRegFee`, override it to `false` when `isFixedPricePlan` is true:

```typescript
// Line ~174-175: change from
const applyRegFee = detectedStatus === "NEW" || ...;
const regFee = applyRegFee ? REG_FEE : 0;

// to
let applyRegFee = detectedStatus === "NEW" || ...;
if (isFixedPricePlan) applyRegFee = false;
const regFee = applyRegFee ? REG_FEE : 0;
```

### `src/components/register/FeeBreakdown.tsx`
No changes needed — the reg fee line already conditionally renders only when `breakdown.regFee > 0`.

### Edge function: `supabase/functions/registration-api/index.ts`
Check if the same `computeFeeBreakdown` logic is duplicated there; if so, apply the same fix.

## Files changed
- `src/lib/enrollmentUtils.ts` — skip reg fee for fixed-price plans
- Possibly `supabase/functions/registration-api/index.ts` — same fix if fee logic is duplicated

