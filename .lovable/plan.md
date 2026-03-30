

# Style Hierarchy Pricing, Payment Allocations & Credit-Based Drop-ins — IMPLEMENTED

## What was done

1. **Database**: Added `style_base`, `eligibility_key` columns to `batches`. Created `payment_allocations` and `drop_in_credits` tables with RLS.
2. **Style Hierarchy** (`src/lib/styleHierarchy.ts`): Jazz(1) > Ballet(2) > Modern(3) > Hip Hop(4) > Heels(5). Primary batch = full price, rest = discounted.
3. **Batches page**: Split style dropdown into Style + Level with eligibility key preview.
4. **Pricing**: Primary batch gets full price, subsequent batches get tiered discount. Per-batch allocations shown in FeeBreakdown.
5. **Payment Allocations**: Inserted on both cash and Razorpay flows. Webhook updated to handle allocations.
6. **Drop-in Credits**: New credit-based system with Issue Credits dialog, eligibility key matching, Credits tab in DropIns page.
7. **Backfill**: Existing batches updated with parsed `style_base` and `level`.

## Next steps
- Update eligibility_key on existing batches (run UPDATE after backfill)
- Build drop-in credit redemption flow in Register.tsx
