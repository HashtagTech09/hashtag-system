# Student Self-Service Portal (No OTP — Phone Entry Only)

## Overview

Public page at `/register` where students browse batches/sessions from the live database and self-register. Phone number is entered without OTP verification for now (OTP can be layered on later). All batch, session, plan cycle, and pricing data comes from existing tables.

## Three Flows

### Flow 1: New Registration

Browse batches (from `batches` table with studio/instructor info) → select batches → enter phone number (lookup in `students` table; if not found, collect name to create student + user record) → auto-detect subscription plan using existing `isPlanValid` logic → show fee breakdown → select payment mode → create payment + enrollment records

### Flow 2: Drop-In

Browse upcoming sessions (from `batch_sessions` table, status=scheduled, future dates) grouped by batch → pick a session → enter phone → same student lookup/creation → show drop-in fee (from `system_settings`) → confirm → create payment + drop_in record

### Flow 3: Returning Student (Renew / Add Batch)

Enter phone number → lookup student → show active enrollments with batch names and validity dates → options to **Renew** (same status detection: NEW/REN/REV, same fee logic) or **Add Batch** (same add-batch logic as admin)

## Architecture

### Shared Logic Extraction

Extract from `Enrollments.tsx` into `src/lib/enrollmentUtils.ts`:

- `isPlanValid` — count-based greedy plan validation
- `computeCycleAssignment` — cycle date computation
- `getDiscount` / `computeFeeBreakdown` — fee calculation (discount tiers, reg fee, GST, drop-in adjustment)
- `detectStudentStatus` — NEW/REN/REV detection
- `getStartCycleIndex` — find first open registration cycle

Both admin `Enrollments.tsx` and public `Register.tsx` import from this shared file.

### New Files

- `src/lib/enrollmentUtils.ts` — shared business logic
- `src/pages/Register.tsx` — main public portal with 3-tab wizard
- `src/components/register/BatchBrowser.tsx` — batch cards fetched from DB
- `src/components/register/SessionBrowser.tsx` — upcoming sessions from DB
- `src/components/register/PhoneEntry.tsx` — phone input + student lookup/creation (no OTP)
- `src/components/register/FeeBreakdown.tsx` — reusable fee summary
- `src/components/register/StudentDashboard.tsx` — returning student view with renew/add options

### Modified Files

- `src/App.tsx` — add `/register` as public route (no ProtectedRoute)
- `src/pages/Enrollments.tsx` — import shared logic from `enrollmentUtils.ts` instead of inline

### RLS Consideration

All existing tables have permissive RLS for `authenticated` role. The public portal uses the anon key which is **not** authenticated. We need to add `anon` SELECT policies on: `batches`, `batch_sessions`, `studios`, `plan_cycles`, `subscription_plans`, `subscription_plan_cycles`, `pricing_plans`, `system_settings`, `students` (for phone lookup). And `anon` INSERT on: `students`, `users`, `enrollments`, `payments`, `drop_ins`.

### Database Changes (migration)

- Add RLS policies allowing `anon` role to SELECT from read-needed tables and INSERT into write-needed tables
- Keep existing `authenticated` policies unchanged

### OTP Later

The `PhoneEntry` component will be designed with a clear separation point — phone input → lookup/create. When OTP is added later, a verification step slots in between phone entry and the lookup, requiring no structural changes.

### Payment

Same as admin flow: records created with selected payment mode and status "success". Payment gateway integration can be added later.

## UI

Mobile-first dark theme matching existing brand. Tab navigation: "Join a Batch" | "Drop-In" | "My Account". Each flow is a step-by-step wizard.