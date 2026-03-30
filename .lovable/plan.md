

# Simplify Payment to Cash + Razorpay Only

## Overview
Remove "UPI" and "Online" payment options. Replace with just two methods: **Cash** (direct insert, existing flow) and **Razorpay** (online payment via Razorpay integration with dual accounts).

## Changes

### 1. Database Migration
- Add columns to `payments`: `razorpay_order_id text`, `razorpay_signature text`, `net_amount numeric`, `rzp_account text`
- Create `pending_enrollments` table (stores enrollment intent until Razorpay webhook confirms)

### 2. Secrets (6 total)
- `RZP_PRIDE_KEY_ID`, `RZP_PRIDE_KEY_SECRET`, `RZP_PRIDE_WEBHOOK_SECRET`
- `RZP_PRUDENT_KEY_ID`, `RZP_PRUDENT_KEY_SECRET`, `RZP_PRUDENT_WEBHOOK_SECRET`

### 3. Edge Function: `create-razorpay-order`
- Accepts student/batch/amount/enrollment data
- Looks up batch → studio code → determines account (pride: NDA/RMG/IPM/SD/GGN, prudent: ED/RG/PP/AV/DWK)
- Creates pending payment + pending_enrollments row
- Calls Razorpay Orders API with correct account credentials
- Passes student name, phone, batch names, plan in Razorpay `notes`
- Returns `order_id`, `razorpay_key_id`

### 4. Edge Function: `razorpay-webhook`
- Verifies signature using correct account's webhook secret (determined from `rzp_account` on payment row)
- Updates payment to `success`, stores `gateway_payment_id`, calculates `net_amount` (amount - Razorpay fee)
- Creates enrollment + enrollment_cycles rows from pending data
- Marks pending_enrollments as `completed`

### 5. Frontend: `StudentDashboard.tsx` + `Register.tsx`
- Replace payment mode dropdown: remove `upi` and `online`, keep only `cash` and `razorpay`
- **Cash flow**: unchanged (direct insert payment + enrollment)
- **Razorpay flow**:
  1. Call `create-razorpay-order` edge function
  2. Load Razorpay checkout script (`checkout.razorpay.com/v1/checkout.js`)
  3. Open checkout modal with returned `order_id` and account-specific `key_id`
  4. On success callback: show success toast, refresh data
  5. On failure: show error toast (payment stays pending)

### 6. Frontend: `Payments.tsx`
- Show `gateway_payment_id` as Razorpay reference
- Show `net_amount` column (amount after Razorpay commission)
- Show `rzp_account` badge (Pride/Prudent)

## Implementation Order
1. Add 6 Razorpay secrets
2. Run database migration
3. Create `create-razorpay-order` edge function
4. Create `razorpay-webhook` edge function
5. Update payment mode dropdowns in StudentDashboard + Register
6. Update Payments page display

