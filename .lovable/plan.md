

# Test Mode, Email Receipts (Resend), WhatsApp (Interakt) & WhatsApp Auth

## Overview
Add a global TEST_MODE toggle in Settings. When ON, all outbound communications (email, WhatsApp) are logged to a `notification_log` table instead of actually sent. Build receipt sending via Resend (email) and Interakt (WhatsApp), plus WhatsApp OTP authentication for the public registration flow.

---

## 1. Database Changes

### New table: `notification_log`
Stores all attempted sends (email, WhatsApp) with payload, channel, status, and whether it was test mode.

| Column | Type | Notes |
|--------|------|-------|
| id | bigint (identity) | PK |
| organization_id | bigint | Default 1 |
| channel | text | 'email' or 'whatsapp' |
| recipient | text | Email or phone |
| template_name | text | e.g. 'payment-receipt' |
| payload | jsonb | Full request body |
| status | text | 'sent', 'test_logged', 'failed' |
| error_message | text | Nullable |
| created_at | timestamptz | Default now() |

RLS: authenticated can read/insert.

### New system_setting
Add `test_mode` key with value `true`/`false` in `system_settings` table (no migration needed, just a row insert via Settings UI).

---

## 2. Secrets Required

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend email API key |
| `INTERAKT_API_KEY` | Interakt WhatsApp API key |

---

## 3. Edge Functions

### `send-receipt` (new)
- Accepts: `{ channel, recipient, template_name, template_data, student_id, payment_id }`
- Reads `test_mode` from `system_settings`
- If test_mode = true: logs to `notification_log` with status `test_logged`, returns success without calling external API
- If test_mode = false:
  - **Email (Resend)**: POST to `https://api.resend.com/emails` with HTML receipt
  - **WhatsApp (Interakt)**: POST to Interakt's template message API
- Logs result to `notification_log` either way

### `send-whatsapp-otp` (new)
- Accepts: `{ phone }`
- Generates 6-digit OTP, stores in a `whatsapp_otp` table (phone, otp, expires_at)
- If test_mode = true: logs OTP to `notification_log`, returns `{ test_otp: "123456" }` so testing works
- If test_mode = false: sends OTP via Interakt WhatsApp template

### `verify-whatsapp-otp` (new)
- Accepts: `{ phone, otp }`
- Validates against `whatsapp_otp` table (checks expiry)
- Returns success/failure

### New table: `whatsapp_otp`
| Column | Type |
|--------|------|
| id | bigint (identity) |
| phone | text |
| otp | text |
| expires_at | timestamptz |
| verified | boolean (default false) |
| created_at | timestamptz |

---

## 4. Frontend Changes

### `Settings.tsx`
- Add a "Test Mode" toggle (Switch component)
- Reads/writes `test_mode` key in `system_settings`
- Show warning badge: "TEST MODE ON — no real messages will be sent"

### `Register.tsx` / `PhoneEntry.tsx`
- Add WhatsApp OTP flow option: enter phone → receive OTP → verify → proceed
- In test mode, show the OTP returned from the edge function (for easy testing)

### Receipt Sending (post-payment)
- After successful payment (cash or Razorpay webhook), call `send-receipt` edge function with both channels (email + WhatsApp)
- Receipt includes: student name, batches, amount paid, payment date, transaction ID

### `Payments.tsx`
- Add "Resend Receipt" button per payment row
- Shows notification log status

---

## 5. Receipt Template
- Build an HTML email template for Resend with: logo area, student name, batches enrolled, amount breakdown, payment mode, transaction ID, date
- WhatsApp receipt uses Interakt's pre-approved template with variables

---

## 6. Implementation Order
1. Add secrets (RESEND_API_KEY, INTERAKT_API_KEY)
2. Database migration (notification_log, whatsapp_otp tables)
3. Create `send-receipt` edge function
4. Create `send-whatsapp-otp` + `verify-whatsapp-otp` edge functions
5. Add Test Mode toggle to Settings
6. Wire receipt sending into payment flows
7. Add WhatsApp OTP to registration PhoneEntry
8. Add "Resend Receipt" to Payments page

