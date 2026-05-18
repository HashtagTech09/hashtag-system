# Delete recently imported data

## What was imported

A single import ran today at 18:22–18:23 UTC and created:

- 21 users
- 25 students
- 120 enrollments
- 334 enrollment_cycles
- 0 payments, 0 payment_allocations, 0 user_roles

No payments or roles were created, so cleanup is contained to the four tables above.

## What this plan does

Delete every record from those four tables whose `created_at >= 2026-05-18 18:22:00 UTC` (covers the full import window). Cutoff is exact and excludes anything older.

Run as a migration in this order (children first to respect references):

1. `enrollment_cycles` — 334 rows
2. `enrollments` — 120 rows
3. `students` — 25 rows
4. `users` — 21 rows

Nothing else is touched. RLS, triggers, schema, auth accounts, and your staff record stay as they are.

## Safety check before delete

I will first run a dry-count inside the migration's transaction-style block to confirm the row counts match (25 / 21 / 120 / 334). If they don't, I'll stop and show you what differs before deleting.

## Technical details

```sql
DELETE FROM enrollment_cycles    WHERE created_at >= '2026-05-18 18:22:00+00';
DELETE FROM enrollments          WHERE created_at >= '2026-05-18 18:22:00+00';
DELETE FROM students             WHERE created_at >= '2026-05-18 18:22:00+00';
DELETE FROM users                WHERE created_at >= '2026-05-18 18:22:00+00'
  AND auth_id IS NULL;  -- guard: never delete a user that has been linked to a login
```

The `auth_id IS NULL` guard on `users` ensures we cannot accidentally remove a staff/admin account if one happened to be created in that window.
