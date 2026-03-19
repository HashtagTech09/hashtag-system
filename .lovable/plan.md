

# Database Schema Audit & Alignment Plan

## Current State vs. Required Architecture

After comparing the existing database with your specification, here are the differences found:

### Differences

| Area | Current | Required | Action |
|------|---------|----------|--------|
| Users table | Named `staff_users`, has `studio_id` and `auth_user_id` columns | Named `users`, no `studio_id`/`auth_user_id`, role includes `parent` | Rename table, drop extra columns, add `parent` to accepted roles |
| Students table | No `user_id` column | `user_id` (nullable) linking to users table | Add column |
| Payments table | Has `gateway_order_id`, `gateway_payment_id` | Not in spec | Drop columns (or keep for future payment gateway use) |
| Batches table | Has `capacity` column | Not in spec | Drop column (or keep as useful metadata) |
| Attendance table | Has `created_at` | Not in spec | Keep (harmless, useful for auditing) |

### What Already Matches

- **organizations** — correct (id, name, created_at), "Hashtag Dance Company" seeded
- **studios** — correct (id, organization_id, name, location, created_at)
- **batches** — correct core columns (id, organization_id, studio_id, instructor_id, name, style, level, days, start_time, end_time)
- **pricing_plans** — correct (id, organization_id, batch_count, price)
- **payments** — core columns correct (id, organization_id, student_id, amount, payment_mode, status, created_at)
- **enrollments** — correct (all columns match)
- **drop_ins** — correct (all columns match)
- **attendance** — correct core columns
- **system_settings** — correct (id, organization_id, key, value)
- All tables use `organization_id`

## Proposed Changes

### Step 1: Database Migration
1. **Rename `staff_users` to `users`** and drop `studio_id`, `auth_user_id` columns
2. **Add `user_id` (nullable bigint)** to `students` table with a foreign key to the new `users` table
3. **Drop `gateway_order_id` and `gateway_payment_id`** from `payments` (unless you want to keep them for future payment gateway integration)
4. **Drop `capacity`** from `batches` (unless you want to keep it)
5. Update all RLS policies to reference the renamed table

### Step 2: Update Frontend Code
- Update all imports and references from `staff_users` to `users` across:
  - `src/pages/Staff.tsx`
  - `src/pages/Batches.tsx` (instructor dropdown)
  - `src/pages/Attendance.tsx`
  - `src/hooks/useAuth.tsx`
  - `src/components/AppSidebar.tsx`
  - `src/integrations/supabase/types.ts` (auto-generated, will update)
- Add `parent` as a role option in the Staff/Users management page
- Update Students page to support optional `user_id` field

### Decision Needed

Before proceeding, one clarification: should the `gateway_order_id`, `gateway_payment_id` (payments) and `capacity` (batches) columns be removed, or kept for future use? They don't conflict with your spec but aren't listed in it.

