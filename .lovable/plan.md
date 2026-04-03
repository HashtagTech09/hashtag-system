

# Delete All Non-Staff Users, Students, and Enrollments

## Summary
Bulk-delete ~784 non-staff users (those without organization-type roles), all 820 students, and all 11,222 enrollments, plus related records in dependent tables.

## Data to delete
From the initial queries:
- **Users with org roles (keep):** ~17 users (4 admin + 13 instructor roles)
- **Non-staff users (delete):** ~784 users
- **Students (delete all):** 820
- **Enrollments (delete all):** 11,222

## Execution order (single migration)
The deletion must respect data dependencies. Execute in this order within one migration:

1. **Delete all `enrollment_cycles`** — references enrollments
2. **Delete all `attendance`** — references students and batches
3. **Delete all `drop_ins`** — references students
4. **Delete all `drop_in_credits`** — references students
5. **Delete all `payment_allocations`** — references payments
6. **Delete all `cycle_adjustments`** — references students
7. **Delete all `pending_enrollments`** — references payments
8. **Delete all `enrollments`** — references students
9. **Delete all `payments`** — references students
10. **Delete all `cash_payment_requests`** — references students
11. **Delete all `students`** — references users
12. **Delete non-staff `user_roles`** — roles for users who have NO organization-type role
13. **Unlink non-staff users from `batches`** (instructor_id, instructor_2_id) and `studios`** (dreamcatcher_id, wingperson_id) — likely not needed for non-staff but safe
14. **Delete non-staff `users`** — users whose id is NOT in the set of users with an organization role

## SQL migration (key logic)

```sql
-- Delete all enrollment-related data
DELETE FROM enrollment_cycles WHERE organization_id = 1;
DELETE FROM attendance WHERE organization_id = 1;
DELETE FROM drop_ins WHERE organization_id = 1;
DELETE FROM drop_in_credits WHERE organization_id = 1;
DELETE FROM cycle_adjustments;
DELETE FROM pending_enrollments;
DELETE FROM payment_allocations;
DELETE FROM enrollments WHERE organization_id = 1;
DELETE FROM payments WHERE organization_id = 1;
DELETE FROM cash_payment_requests WHERE organization_id = 1;

-- Delete all students
DELETE FROM students WHERE organization_id = 1;

-- Delete non-staff users (those without an organization role)
DELETE FROM user_roles
WHERE organization_id = 1
AND user_id NOT IN (
  SELECT ur.user_id FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.type = 'organization'
);

DELETE FROM users
WHERE organization_id = 1
AND id NOT IN (
  SELECT ur.user_id FROM user_roles ur
  JOIN roles r ON ur.role_id = r.id
  WHERE r.type = 'organization'
);
```

## Files changed
- **Database migration only** — no code changes needed

## Risk
This is irreversible. All student, enrollment, payment, attendance, and drop-in data will be permanently deleted. Only the ~17 staff users (admins + instructors) and their roles will remain.

