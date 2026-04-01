

# Fix Smart Import: Students-First with Name+Phone Uniqueness

## Problem
The DB has a unique constraint `students_organization_id_phone_key` (phone unique per org), but the business model allows multiple students per phone (e.g., Sakshi, Parnika, Varnika all share one parent phone). The import also looks up students by phone only, which breaks when multiple students share a phone.

## Approach
1. **Drop the DB constraint** `students_organization_id_phone_key` and replace with `(organization_id, name, phone)` — allowing multiple students per phone but preventing exact duplicates.
2. **Reorder import logic**: Create students first (keyed by name+phone), then create users for each unique phone (using first occurrence name).
3. **Fix student lookup**: Use `name+phone` map instead of `phone`-only map to find the correct student for each row.

## Changes

### 1. Database migration
```sql
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_organization_id_phone_key;
ALTER TABLE public.students ADD CONSTRAINT students_organization_id_name_phone_key UNIQUE (organization_id, name, phone);
```

### 2. `src/pages/Import.tsx` — `importSmartEnrollments`
Rewrite the user/student creation flow:

**Step 1 — Build student dedup map (name+phone)**
- Key: `name.toLowerCase().trim()|phone`
- Collect unique students from CSV rows
- Check against existing students in DB (fetched with name+phone)

**Step 2 — Create users first for each unique phone**
- Deduplicate by phone only
- Use the first occurrence's name as the user name
- Skip phones that already exist in `users` table

**Step 3 — Create students**
- For each unique name+phone combo not already in DB
- Link to user via `phoneToUserId`

**Step 4 — Build student lookup by name+phone for enrollment processing**
- Change `phoneToStudentId` → `namePhoneToStudentId` (Map keyed by `name|phone`)
- Each row looks up student by `studentKey(row.student_name, row.student_phone)`

### 3. Also fix `importEnrollments` (existing enrollment import)
Apply the same name+phone pattern for consistency.

## Files changed
- Database migration — drop old constraint, add new `(org, name, phone)` constraint
- `src/pages/Import.tsx` — reorder creation (users → students), use name+phone lookup

