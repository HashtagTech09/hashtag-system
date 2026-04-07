

# Delete All Non-Staff Users, Students, and Enrollments

## Current data
- **Users:** 799 total, 17 staff (to keep), ~782 non-staff (to delete)
- **Students:** 818 (delete all)
- **Enrollments:** 66 (delete all)
- **Enrollment cycles:** 433 (delete all)
- **Payments:** 0
- **Attendance:** 0

## Execution
Single migration deleting in dependency order:

1. `enrollment_cycles`
2. `attendance`
3. `drop_ins`
4. `drop_in_credits`
5. `cycle_adjustments`
6. `pending_enrollments`
7. `payment_allocations`
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
Irreversible. All student, enrollment, and related data will be permanently deleted. Only ~17 staff users remain.

