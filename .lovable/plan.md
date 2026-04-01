

# Incremental Per-Batch Discounts

## Current behavior
All non-primary batches get the **same** discount based on total batch count (e.g., 3 batches → all non-primary get 13%).

## Desired behavior
Each batch position gets its own discount:
- 1st batch (primary): 0%
- 2nd batch: 12%
- 3rd batch: 13%
- 4th batch: 14%
- 5th+ batch: 15%

## Changes

### `src/lib/enrollmentUtils.ts`

1. **Replace `getDiscount(count)`** with a **per-position** helper:
```typescript
export function getBatchDiscount(position: number): number {
  // position is 1-indexed: 1=primary, 2=12%, 3=13%, etc.
  if (position <= 1) return 0;
  const tiers: Record<number, number> = { 2: 0.12, 3: 0.13, 4: 0.14 };
  return tiers[position] ?? 0.15;
}
```

2. **Rewrite `computeFeeBreakdown`** to loop over batches and sum individually instead of using `primaryFee + discountedPerBatch * (N-1)`:
```text
totalBatchFee = 0
for each batch at position i (1-indexed):
  discount = getBatchDiscount(i)
  batchAmount = round(perBatchFee * (1 - discount))
  totalBatchFee += batchAmount
  store batchAmount in allocation
discountAmount = (perBatchFee * batchCount) - totalBatchFee
```

3. **Update `batchAllocations`** to use position-specific amounts instead of a single `discountedPerBatch`.

4. **Update `FeeBreakdown` interface**: remove single `discountPct` field (no longer meaningful as one number) or keep it as 0 for backward compat.

### `src/components/register/FeeBreakdown.tsx`

Update the per-batch line items to show each batch's specific discount percentage instead of one flat rate:
```text
Jazz Batch (Primary)         ₹X
Ballet Batch (12% off)       ₹Y
Hip Hop Batch (13% off)      ₹Z
```

This requires adding a `discountPct` field to `BatchAllocation` so the UI can display it.

### `BatchAllocation` interface update
```typescript
export interface BatchAllocation {
  batch_id: number;
  batch_name: string;
  style_base: string;
  is_primary: boolean;
  amount: number;
  discountPct: number; // new: 0 for primary, 0.12 for 2nd, etc.
}
```

## Files changed
- `src/lib/enrollmentUtils.ts` — new per-position discount logic, updated fee computation
- `src/components/register/FeeBreakdown.tsx` — display per-batch discount percentage

