

# Delete All Non-Staff Users, Students, and Enrollments

## Current data
- **Users:** 799 total, 14 staff IDs to keep (10–20, 29–31)
- **Students:** 818 (delete all)
- **Enrollments:** 691 (delete all)
- **Enrollment cycles:** 2,557 (delete all)
- **Payments:** 0
- **Other related tables:** all empty (drop_ins, cash_requests, etc.)

## Execution
Single migration deleting in dependency order:

1. `enrollment_cycles` — DELETE ALL
2. `cycle_adjustments` — DELETE ALL
3. `drop_ins` — DELETE ALL
4. `drop_in_credits` — DELETE ALL
5. `pending_enrollments` — DELETE ALL
6. `payment_allocations` — DELETE ALL
7. `enrollments` — DELETE ALL
8. `payments` — DELETE ALL
9. `cash_payment_requests` — DELETE ALL
10. `students` — DELETE ALL
11. `user_roles` — DELETE WHERE user_id NOT IN (10–20, 29, 30, 31)
12. `users` — DELETE WHERE id NOT IN (10–20, 29, 30, 31)

Staff preserved (14 users): Ashish, Astha Tomar (x2), Ayushi, Dhriti, Divija, Jahnvi, Jhilmil, Kriti, Manas, Priyanshi, Rubani, Shivek, Tarun.

## Files changed
- Database migration only — no code changes

## Risk
Irreversible. All student, enrollment, and related data permanently deleted.

