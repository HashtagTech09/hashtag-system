

# Delete All Non-Staff Users, Students, and Enrollments

## Current data
- **Users:** 799 total, 14 staff (to keep), ~785 non-staff (to delete)
- **Students:** 818 (delete all)
- **Enrollments:** 3,173 (delete all)

## Execution
Single migration deleting in dependency order:

1. `enrollment_cycles` (refs enrollments)
2. `attendance` (refs students)
3. `drop_ins` (refs students)
4. `drop_in_credits` (refs students)
5. `cycle_adjustments` (refs students)
6. `pending_enrollments` (refs payments)
7. `payment_allocations` (refs payments)
8. `enrollments`
9. `payments`
10. `cash_payment_requests`
11. `students`
12. Non-staff `user_roles`
13. Non-staff `users`

Staff identification: users with a role where `roles.type = 'organization'` are preserved.

## Files changed
- Database migration only — no code changes

## Risk
Irreversible. All student, enrollment, payment, attendance, and drop-in data will be permanently deleted. Only ~14 staff users remain.

