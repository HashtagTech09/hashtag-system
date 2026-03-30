

# CSV Import Page for Users, Students & Enrollments

## Overview
Add an admin "Import Data" page where you can upload CSV files exported from Google Sheets to bulk-import users, students, and enrollments into the system.

## Approach
Build a new `/import` admin page with a step-by-step wizard: select table → upload CSV → preview/map columns → import.

## Changes

### 1. New Page: `src/pages/Import.tsx`
- Tab-based UI with 3 tabs: **Users**, **Students**, **Enrollments**
- Each tab has:
  - File upload input (accepts `.csv`)
  - Preview table showing first 5 rows after upload
  - Column mapping: dropdowns to map CSV columns → database columns
  - "Import" button that inserts rows via Supabase client
- Expected CSV columns per table:
  - **Users**: name, phone, email, source
  - **Students**: name, phone, email, dob, gender, user_phone (to link by phone lookup)
  - **Enrollments**: student_phone, batch_name, start_date, end_date, status_type, subscription_plan_name
- Import logic:
  - Users: insert with `organization_id = 1`, skip duplicates by phone
  - Students: look up `user_id` by phone from users table, insert with `organization_id = 1`
  - Enrollments: look up `student_id` by phone, `batch_id` by name, cycle IDs by date matching, insert enrollment + enrollment_cycles
- Show progress bar and success/error count after import

### 2. Add Route: `src/App.tsx`
- Add `/import` route pointing to `Import.tsx`

### 3. Add Nav Link: `src/components/AppSidebar.tsx`
- Add "Import Data" link under Settings in the sidebar

## Technical Details
- CSV parsing: use `papaparse` library (add as dependency)
- All inserts use the existing Supabase client with `organization_id = 1`
- Duplicate handling: upsert by phone for users, skip existing student+user combos
- Enrollment import auto-generates `enrollment_cycles` rows using the `allocateCyclesForPlan` utility from `cycleUtils.ts`
- Batch size: insert in chunks of 50 rows to avoid timeouts

