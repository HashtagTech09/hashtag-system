

# Selective Data Reset

## What will be done
1. Delete all `attendance` records
2. Delete all `drop_ins` records  
3. Delete all `enrollments` records
4. Delete all `payments` records
5. Delete `user_roles`, `students`, and `users` for everyone **except** the user named "Shivek Singhal"
6. Unlink deleted users from `batches` (instructor_id) and `studios` (dreamcatcher_id, wingperson_id)

## Preserved data
- Studios, batches, plan cycles, subscription plans, pricing plans, system settings — all kept
- User "Shivek Singhal" and their roles/students — kept

## Execution
All done via data delete/update queries (no schema changes needed).

