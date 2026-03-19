

# Display Contact Fallback Logic for Students

## Overview
Add display-level phone/email fallback across all screens: show student's own contact if available, otherwise fall back to linked user's contact. No database changes.

## Shared Utility

Create `src/lib/studentUtils.ts` with helper functions:
- `getDisplayPhone(student)` — returns `student.phone || student.users?.phone || "—"`
- `getDisplayEmail(student)` — returns `student.email || student.users?.email || "—"`
- `getContactSource(studentValue, userValue)` — returns `"Student"` if student has own value, `"Primary"` if falling back from user, or `null` if neither

## Changes by File

### 1. Students Page (`src/pages/Students.tsx`)
- **Query**: `select("*, users(name, phone, email)")` to fetch user contact data
- **Table**: Use `getDisplayPhone` / `getDisplayEmail` with subtle badge — **"Primary"** (from user) or **"Student"** (student's own)
- **Search**: Match against both `student.phone` and `student.users?.phone`

### 2. Attendance Page (`src/pages/Attendance.tsx`)
- **Query**: Include `students(id, name, phone, users(phone))` in enrollment select
- **Display**: Show `display_phone` next to student name

### 3. Payments Page (`src/pages/Payments.tsx`)
- **Query**: `select("*, students(name, phone, users(phone))")`
- **Display**: Add phone column with fallback

### 4. Enrollments Page (`src/pages/Enrollments.tsx`)
- **Query**: `select("*, students(name, phone, users(phone)), batches(name)")`
- **Display**: Add phone column with fallback

### Visual Indicator
- Contact from user → small muted **"Primary"** label
- Student's own contact → small muted **"Student"** label

