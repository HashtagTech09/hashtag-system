

# Style Hierarchy Pricing, Payment Allocations & Credit-Based Drop-ins

## Summary
Three major changes: (1) split batch `style` into separate `style` + `level` fields with a pricing hierarchy, (2) add `payment_allocations` table for per-batch revenue tracking, (3) new credit-based drop-in system with eligibility matching.

## Current State
- Batches store `style` as a combined string like "Jazz Level 1", "Kids Jazz Level 2"
- Pricing applies a flat discount by batch count (no hierarchy ordering)
- Drop-ins are session-based bookings (1 drop-in = 1 session), no credits
- No per-batch payment allocation tracking

---

## 1. Database Changes

### Migration: Add `style_base` and `level` columns to `batches`
```sql
ALTER TABLE public.batches
  ADD COLUMN style_base text,
  ADD COLUMN level text;
```
Then backfill from existing `style` field:
- "Jazz Level 1" → style_base=Jazz, level=Level 1
- "Kids Jazz" → style_base=Jazz, level=Kids
- "Kids Jazz Level 2" → style_base=Jazz, level=Kids Level 2
- "Hip Hop Level 3" → style_base=Hip Hop, level=Level 3

Keep existing `style` column for display/backward compat. Add `eligibility_key` as computed: `UPPER(style_base) + "-" + UPPER(level)`.

### Migration: Create `payment_allocations` table
```sql
CREATE TABLE public.payment_allocations (
  id bigint generated always as identity primary key,
  payment_id bigint NOT NULL,
  batch_id bigint NOT NULL,
  studio_id bigint,
  allocated_amount numeric NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
-- RLS policies for anon insert + authenticated full access
```

### Migration: Create `drop_in_credits` table
```sql
CREATE TABLE public.drop_in_credits (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL DEFAULT 1,
  student_id bigint NOT NULL,
  eligibility_key text NOT NULL,  -- e.g. "JAZZ-LEVEL 1"
  credits_total integer NOT NULL DEFAULT 1,
  credits_used integer NOT NULL DEFAULT 0,
  expiry_date date,
  payment_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drop_in_credits ENABLE ROW LEVEL SECURITY;
-- RLS: anon read/insert, authenticated full access
```

Add `eligibility_key` column to `batches` table as well.

---

## 2. Style Hierarchy & Pricing Logic

### New file: `src/lib/styleHierarchy.ts`
- Define `STYLE_HIERARCHY`: `{ Jazz: 1, Ballet: 2, Modern: 3, "Hip Hop": 4, Heels: 5 }`
- `parseStyle(combined: string)`: extracts `style_base` and `level` from combined style string
- `buildEligibilityKey(styleBase, level)`: returns uppercase `"JAZZ-LEVEL 1"`
- `sortBatchesByHierarchy(batches)`: sorts by `STYLE_HIERARCHY[style_base]` ascending (Jazz first = highest priority)

### Update `src/lib/enrollmentUtils.ts`
- `computeFeeBreakdown` now accepts sorted batches: first batch = full price, rest = discounted
- The discount is no longer a flat % for all batches — instead:
  - Batch 1 (highest hierarchy): full `perBatchFee` (0% discount)
  - Batches 2+: apply existing discount tiers (12%/13%/14%/15% based on total count)

### Update `computePaymentAllocations(batches, breakdown)`
- Returns array of `{ batch_id, studio_id, allocated_amount, is_primary }`
- Primary batch gets full price amount, others get discounted amount

---

## 3. Frontend Changes

### `src/pages/Batches.tsx`
- Replace single `style` dropdown with two dropdowns:
  - **Style**: Jazz, Ballet, Modern, Hip Hop, Heels
  - **Level**: Kids, Level 1, Level 2, Level 3, Level 4, Level 5, Kids Level 2
- On save, compute `style` (display), `style_base`, `level`, `eligibility_key`
- Show eligibility key in batch list

### `src/components/register/StudentDashboard.tsx` & `src/pages/Register.tsx`
- When building enrollment, sort selected batches by style hierarchy
- After payment (cash or Razorpay), insert `payment_allocations` rows
- Update `FeeBreakdown` display to show which batch is primary (full price) vs discounted

### `src/components/register/FeeBreakdown.tsx`
- Show per-batch line items: "Jazz Level 1 (Primary) — ₹X,XXX" and "Hip Hop Level 2 (12% off) — ₹X,XXX"

### `src/pages/Payments.tsx`
- Add expandable row or tooltip showing per-batch allocations

### `src/pages/DropIns.tsx`
- Add "Issue Credits" dialog: select student, eligibility_key, number of credits
- Show credits table with remaining balance
- Change drop-in recording to deduct from `drop_in_credits` instead of creating standalone records

---

## 4. Drop-in Credit Redemption Flow

### New in `Register.tsx` (Drop-In tab)
- After student identified, fetch their `drop_in_credits` with remaining balance
- Show: "You have X credits for Jazz - Level 1"
- Only show batches where `batch.eligibility_key === credit.eligibility_key`
- On selection: deduct 1 credit (`credits_used += 1`), create `drop_ins` record linking to the credit

---

## 5. Webhook & Edge Function Updates

### `razorpay-webhook/index.ts`
- After creating enrollments, also insert `payment_allocations` from `pending_enrollments.enrollment_data`

### `create-razorpay-order/index.ts`
- Include `payment_allocations` data in `enrollment_data` JSON

---

## 6. Implementation Order
1. Database migrations (3 migrations)
2. Create `styleHierarchy.ts` utility
3. Update `Batches.tsx` — split style/level dropdowns
4. Backfill existing batches with `style_base`, `level`, `eligibility_key`
5. Update pricing logic in `enrollmentUtils.ts`
6. Update `FeeBreakdown.tsx` for per-batch display
7. Update `StudentDashboard.tsx` and `Register.tsx` — hierarchy sorting + allocations
8. Update webhook to insert allocations
9. Update `DropIns.tsx` — credit-based system
10. Update Register drop-in flow — credit redemption with eligibility matching

