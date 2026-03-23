

# Enforce User-Linked Students

## Overview
Make `user_id` required on students. Restructure the student creation flow so users must first find/create a user by phone, then create the student under that user.

## Database Migration

1. Backfill any existing students with `user_id IS NULL` — create placeholder users for them (or block migration if none exist)
2. `ALTER TABLE students ALTER COLUMN user_id SET NOT NULL`

## Frontend Changes (`src/pages/Students.tsx`)

### New "Phone-first" creation flow
Replace the current form with a two-step process:

**Step 1 — Find or Create User**
- Input: phone number (required)
- On submit: search `users` table for matching phone + `organization_id = 1`
  - **Found**: Show user name, auto-select as the linked user, proceed to Step 2
  - **Not found**: Show inline fields to create a new user (name, email optional), create the user row, then proceed to Step 2

**Step 2 — Create Student**
- User is locked in (shown as read-only badge)
- Fields: student name, DOB, gender, photo
- Phone/email default from linked user (editable for student-specific overrides)
- Save creates student with `user_id` set (required)

### Edit flow
- User link shown as read-only (can change user via dropdown if needed)
- `user_id` always required on save

### Validation
- `handleSave`: reject if no `user_id` selected — `toast.error("A linked user is required")`
- Remove `user_id: form.user_id ? Number(form.user_id) : null` → always `Number(form.user_id)`

### Form state changes
- Add `step: 1 | 2` to track flow
- Add `searchPhone: string` for phone lookup
- Add `newUserName: string` for creating new user inline

## Summary of Changes
1. **Migration**: Make `user_id NOT NULL` on students
2. **Students page**: Two-step creation (phone lookup → student details), user always required

