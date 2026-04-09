

# Staff Login & Personalized Portal

## Overview
Each staff member gets their own login (email/password or phone OTP) and sees a personalized dashboard filtered to only the studios and batches they're assigned to. Admins see everything.

## Architecture

### Linking staff to auth accounts

The `users` table (custom staff table) currently has no link to Supabase Auth (`auth.users`). We'll add an `auth_id` column (uuid, nullable) to bridge them.

**Login flow:**
1. Staff enters email/password → Supabase Auth signs them in → get `auth.uid()`
2. Look up `users` row where `auth_id = auth.uid()` to find their staff record + roles
3. If phone OTP: staff enters phone → WhatsApp OTP → verify → look up `users` by phone → create/link Supabase Auth account

**Staff account provisioning:** On the Staff page, admins can "Create Login" for a staff member, which calls `supabase.auth.admin.createUser()` via an edge function and stores the resulting `auth_id` on the `users` row.

### Personalized portal logic

After login, fetch the staff member's roles and determine what they see:

```text
Admin/Manager  → Full sidebar, all studios/batches (current behavior)
Instructor     → My Batches, My Studios, Attendance, Student List
Frontdesk      → Studios they're assigned to, Attendance, Enrollments
```

**"My Batches"**: `batches WHERE instructor_id = staffId OR instructor_2_id = staffId`
**"My Studios"**: `studios WHERE wingperson_id = staffId OR dreamcatcher_id = staffId` + studios of assigned batches

## Database changes

1. **Migration**: Add `auth_id uuid` column to `users` table
2. **Migration**: Create unique index on `users(auth_id)` where not null

## New edge function

**`create-staff-auth`** — Admin-only function that:
- Receives `{ user_id, email, password }` 
- Creates a Supabase Auth user via service role
- Updates `users.auth_id` with the new auth user's ID
- Returns success/failure

## File changes

### `src/hooks/useAuth.tsx`
- After auth state change, fetch staff record from `users` where `auth_id = session.user.id`
- Store `staffUser` (the `users` row) and `staffRoles` (from `user_roles`) in context
- Expose `staffUser`, `staffRoles`, `isAdmin`, `isInstructor` etc.

### `src/pages/Login.tsx`
- Add tabs: "Email & Password" | "Phone OTP"
- Phone tab reuses WhatsApp OTP flow (send-whatsapp-otp / verify-whatsapp-otp)
- After phone verification, look up `users` by phone, sign in via a custom token or link auth account
- Remove "Sign Up" toggle — staff accounts are created by admins only

### `src/components/AppSidebar.tsx`
- Read `staffRoles` from `useAuth()`
- Filter sidebar items based on role:
  - Admin/Manager: show all items
  - Instructor: Dashboard, My Batches, Attendance, Students
  - Frontdesk: Dashboard, Studios, Students, Enrollments, Payments, Attendance

### New: `src/pages/StaffDashboard.tsx`
- Personalized landing page for non-admin staff
- **My Batches** section: cards showing batch_code, schedule, studio name, student count
- **My Studios** section: cards showing studio name, location, Google Maps link
- **Today's Sessions** section: batch_sessions for today for their batches
- Quick action: "Mark Attendance" button per batch

### `src/pages/Attendance.tsx`
- For instructors: auto-filter to only their batches
- For admin: current behavior (see all)

### `src/pages/Staff.tsx`
- Add "Create Login" button per staff row (only if `auth_id` is null)
- Opens dialog to set email + temporary password
- Calls `create-staff-auth` edge function

### `src/App.tsx`
- Route `/` conditionally renders `StaffDashboard` for non-admin roles, `Dashboard` for admins
- Or add a new `/my-dashboard` route for staff portal

## Summary of new/changed files
- **Migration**: add `auth_id` to `users`
- **New edge function**: `supabase/functions/create-staff-auth/index.ts`
- **New page**: `src/pages/StaffDashboard.tsx`
- **Modified**: `useAuth.tsx`, `Login.tsx`, `AppSidebar.tsx`, `App.tsx`, `Staff.tsx`, `Attendance.tsx`

