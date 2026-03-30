
## Findings
- Test mode is actually working.
- The latest OTP requests returned success from the backend with test OTPs:
  - `396166`
  - `887091` (latest)
- So the failure is not the OTP generation itself; it is the client interpreting the response incorrectly.

## Root cause
`send-whatsapp-otp` returns JSON, but its responses do not include `Content-Type: application/json`.

Because of that:
- `supabase.functions.invoke()` does not reliably give `data` as a parsed object
- `PhoneEntry.tsx` checks `!data?.success`
- the UI shows `Failed to send OTP` even though the backend already returned `{ success: true, test_mode: true, test_otp: "..." }`

The same header issue also exists in:
- `supabase/functions/verify-whatsapp-otp/index.ts`
- `supabase/functions/send-receipt/index.ts`

## Implementation plan
1. Fix all edge-function responses to always return:
   ```ts
   headers: { ...corsHeaders, "Content-Type": "application/json" }
   ```
   in:
   - `supabase/functions/send-whatsapp-otp/index.ts`
   - `supabase/functions/verify-whatsapp-otp/index.ts`
   - `supabase/functions/send-receipt/index.ts`

2. Harden `PhoneEntry.tsx`
   - keep the `error || !data?.success` guard
   - add a defensive fallback so if response parsing is ever wrong again, the toast shows the raw server message instead of generic failure
   - keep showing the `test_otp` badge when test mode is on

3. Improve function robustness
   - switch the `test_mode` lookup to a safer single-row pattern
   - add lightweight logs around:
     - test mode detected / not detected
     - OTP insert success/failure
     - notification log insert success/failure
   - do not log secrets

## Expected result after fix
- With test mode ON:
  - clicking “Send OTP” moves to the OTP screen
  - the yellow test-mode OTP badge appears
  - entering the shown OTP verifies successfully
- With test mode OFF and provider failure:
  - the UI stays on the phone step
  - the real provider error is shown clearly

## Technical notes
- No database change is needed.
- This is mainly a response-header contract issue between the backend function and `supabase.functions.invoke()`.
- I’ll also standardize the same fix for receipt sending so the same bug does not show up there later.
