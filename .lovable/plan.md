

# Update Schema: Move source to users, add optional fields

## Database Migration

1. **Add `source` column to `users` table** (text, nullable)
2. **Add `photo` column to `users` table** (text, nullable) — for parent profile photos
3. **Drop `source` column from `students` table**
4. **Drop `parent_name` and `parent_phone` from `students` table** (per previous plan)
5. **Add optional columns to `students` table:**
   - `dob` (date, nullable)
   - `gender` (text, nullable)
   - `photo` (text, nullable)
6. **Create a storage bucket** `photos` for uploading student and user profile photos

## Frontend Changes

### Students Page (`src/pages/Students.tsx`)
- Remove `source`, `parent_name`, `parent_phone` from form
- Add optional fields: `dob` (date picker), `gender` (select: Male/Female/Other), `photo` (image upload)
- Add `user_id` dropdown to link student to an account holder
- By default, copy `phone` and `email` from the linked user when selecting one
- Show linked user name in the table

### Staff Page (`src/pages/Staff.tsx`)
- Add `source` field (text input) to the staff/user form
- Add `photo` upload field (shown for all roles, but especially relevant for parents)
- Show source in the table

### Storage
- Set up `photos` bucket with public read access for displaying profile images

## Data Flow

```text
users table                    students table
├─ name                        ├─ name
├─ email                       ├─ phone (default from user)
├─ phone                       ├─ email (default from user)
├─ role                        ├─ dob (optional)
├─ source (moved here)         ├─ gender (optional)
├─ photo (for parent/user)     ├─ photo (optional)
└─ organization_id             └─ user_id → users.id
```

