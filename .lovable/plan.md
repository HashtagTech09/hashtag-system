

# Fix OTP Flow — Enable Test Mode + Debug Edge Function

## Problem
The `send-whatsapp-otp` function returned `{"success":false}` because:
1. Test mode is not enabled in `system_settings`, so it tried to send via Interakt
2. The Interakt API call likely failed (no proper API key or template not configured)
3. The function returns `{"success": false}` on Interakt failure but the frontend still shows the OTP screen, with no way to know the code

## Root Cause
Looking at the edge function, when test mode is OFF and Interakt fails, it returns `{ success: res.ok }` which is `false`. But the frontend `PhoneEntry.tsx` only checks for `error` from `supabase.functions.invoke`, not `data.success`:

```typescript
if (error) {
  toast.error("Failed to send OTP");
  return;
}
// It proceeds to setOtpSent(true) even when data.success is false
```

## Fixes

### 1. Fix `PhoneEntry.tsx` — check `data.success`
After the invoke call, also check `if (!data?.success)` and show an error toast instead of proceeding to the OTP entry screen.

### 2. Ensure test mode toggle works
Verify the Settings page correctly inserts/updates the `test_mode` key in `system_settings`. If the row doesn't exist yet, it needs to be created on first toggle.

### 3. Improve edge function error handling
The `send-whatsapp-otp` function should return a clearer error message when Interakt fails, so the frontend can display it.

## Technical Changes

**`src/components/register/PhoneEntry.tsx`** — line ~42:
```typescript
if (error || !data?.success) {
  toast.error(data?.error || "Failed to send OTP");
  return;
}
```

This ensures the OTP screen only appears when the OTP was actually sent (or test-logged).

## Immediate Action
Enable Test Mode in Settings first, then retry. The OTP will display on screen.

