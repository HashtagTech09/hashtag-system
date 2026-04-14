

# Forgot Password / Reset Password Flow

## Overview
Add a "Forgot password?" link on the Login page and a `/reset-password` page where staff can set a new password after clicking the email link.

## Changes

### 1. `src/pages/Login.tsx`
- Add a `forgotPassword` state toggle
- When active, show an email-only form that calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`
- Add a "Forgot password?" link below the sign-in button
- Add a "Back to login" link on the forgot password view
- Show success toast: "Check your email for a password reset link"

### 2. `src/pages/ResetPassword.tsx` (new)
- Public page at `/reset-password`
- On mount, detect `type=recovery` in URL hash (Supabase redirects with this)
- Show a form with "New Password" + "Confirm Password" fields
- On submit, call `supabase.auth.updateUser({ password })`
- Show success message and link back to `/login`
- Match the existing Login page styling (glass-card, Hashtag logo, etc.)

### 3. `src/App.tsx`
- Import `ResetPasswordPage`
- Add route: `<Route path="/reset-password" element={<ResetPasswordPage />} />` (public, no auth wrapper)

## Files changed
- `src/pages/Login.tsx` — forgot password form + link
- `src/pages/ResetPassword.tsx` — new page
- `src/App.tsx` — new route

