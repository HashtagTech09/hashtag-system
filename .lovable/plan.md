

# Fix OTP Verification & Duplicate Student Detection

## Problems
1. **`lookupStudent` query is broken** — The `.or()` filter uses `users.phone.ilike.%${searchPhone}` which doesn't work with PostgREST joined tables. This causes the lookup to fail silently, sending existing students to the "Create Account" flow instead of recognizing them.
2. **No duplicate check on account creation** — When an existing student enters the "Create Account" step, the insert fails with a database error but no user-friendly message like "You're already registered."

## Root Cause
Line 85 in `PhoneEntry.tsx`:
```typescript
.or(`phone.ilike.%${searchPhone},users.phone.ilike.%${searchPhone}`)
```
`users.phone` is a joined table column — PostgREST ignores or errors on this, so the query only matches `students.phone`, missing students whose phone is on the `users` table only.

## Fix — `src/components/register/PhoneEntry.tsx`

### 1. Rewrite `lookupStudent` with two separate queries
- Query 1: Search `students` table by `phone`
- Query 2: Search `users` table by `phone`, then look up linked students
- If either finds a match → call `onStudentFound`
- If no match → call `onNewUser`

### 2. Add duplicate detection in `JoinBatchFlow` and `DropInFlow` (`src/pages/Register.tsx`)
- In `handleCreateAndProceed`, before inserting, check if a user with that phone already exists
- If found, show toast: "This phone number is already registered. Please go back and verify again."
- Or better: auto-recover by looking up the student and proceeding to the pay step

### 3. Add loading state to `lookupStudent`
- Show a "Looking up your account..." state after OTP verification while the lookup runs

## Files Changed
- `src/components/register/PhoneEntry.tsx` — fix lookupStudent query, add loading state
- `src/pages/Register.tsx` — add duplicate phone check in both `handleCreateAndProceed` functions

