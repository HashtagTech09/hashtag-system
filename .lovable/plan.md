

# Add Batch (Add-On) Feature for Existing Enrollments

## Overview
Allow students who already enrolled in a cycle to add more batches at the multi-batch discount rate, as long as the enrollment period is still within the grace period. The discount tier is based on total batches (existing + new).

## How It Works
1. **New "Add Batch" dialog** — separate from the "New Enrollment" dialog
2. User selects a student → system fetches their **active enrollments** (where `end_date >= today` or within grace period of the active cycle)
3. Shows which batches the student is already enrolled in (non-selectable, greyed out)
4. User picks additional batches to add
5. **Discount is calculated based on total batch count** (existing + new). For example: student has 1 batch, adds 1 more → 2-batch discount (12%) applied to the new batch's cycle fee
6. No registration fee (already paid). Drop-in adjustment still eligible
7. **Fee breakdown** shows: per-batch fee, discount tier (based on total count), GST, total
8. On confirm: creates new enrollment records + payment record, inheriting the same `subscription_plan_id`, `start_cycle_id`, `end_cycle_id`, `start_date`, `end_date` from the existing enrollment

## Changes to `src/pages/Enrollments.tsx`

### New State
- `addBatchOpen` — dialog visibility
- `addBatchForm` — `{ student_id, new_batch_ids[], payment_mode }`
- `existingBatches` — fetched from active enrollments for the selected student
- `existingEnrollment` — reference enrollment (for dates/plan/cycles)

### New Logic
- `fetchExistingEnrollments(studentId)` — query enrollments where student's enrollment period covers the current active cycle (or within grace)
- `computeAddBatchFee()` — uses same `DISCOUNT_TIERS` and cycle pricing, but:
  - `totalBatchCount = existingBatches.length + newBatchIds.length`
  - Discount % = `getDiscount(totalBatchCount)`
  - Charges only for the **new** batches at the discounted per-batch rate
  - No registration fee
  - 18% GST on subtotal
- `handleAddBatch()` — creates payment + enrollment records for new batches only

### New UI
- "Add Batch" button next to "New Enrollment" button
- Dialog with: student selector → shows existing batches (disabled) → pick new batches → fee breakdown → confirm

### Grace Period Check
Reuse the same logic: a student qualifies if their existing enrollment's `end_date` is either ≥ today, or expired but within the active cycle's grace period.

## No Database Changes
All existing tables support this — enrollments, payments, batches are reused as-is.

