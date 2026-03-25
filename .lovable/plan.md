

# Add GST and Final Amount Columns to Payments Table

## Current State
The `payments` table already has: `id`, `organization_id`, `student_id`, `amount`, `status` (pending/success/failed), `payment_mode`, `gateway_order_id`, `gateway_payment_id`, `created_at`.

## Change
Add two new columns via migration:
- `gst` (numeric, nullable, default null) — GST component
- `final_amount` (numeric, nullable, default null) — total after GST

## Code Update
Update `handleEnroll` in `src/pages/Enrollments.tsx` to save `gst` and `final_amount` when creating the payment record, using the values already computed in `computeFeeBreakdown()`.

