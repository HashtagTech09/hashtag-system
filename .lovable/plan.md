

# Remove All Non-Staff Users

## What gets kept
The 14 staff users (anyone with an `organization`-type role: admin / manager / instructor / frontdesk):
Priyanshi Kamboj, Manas Yellapantula, Jahnvi Rao, Dhriti Khanduja, Ayushi Pathania, Kriti Rao, Jhilmil Modi, Divija Malhotra, Shivek Singhal, Tarun Ahuja, Ashish, Astha Tomar (×2), Rubani Manaktala — plus their `user_roles` rows and any batch/studio assignments (untouched).

## What gets deleted
| Table | Approx rows |
|---|---|
| enrollment_cycles | 3,683 |
| enrollments | 1,056 |
| students | 818 (all — none belong to staff) |
| abandoned_carts | 7 |
| user_roles (non-staff) | ~785 |
| users (non-staff) | ~785 |

Tables already empty (payments, drop_ins, drop_in_credits, attendance, cash_payment_requests, cycle_adjustments, payment_allocations, pending_enrollments) — nothing to do.

## Deletion order (respects references)
```text
1. enrollment_cycles    → references enrollments/students
2. enrollments          → references students
3. abandoned_carts      → references students
4. students             → references users
5. user_roles (non-staff) → references users
6. users (non-staff)    → final
```

The single SQL transaction will use this filter to identify non-staff users:
```sql
user_id NOT IN (
  SELECT DISTINCT ur.user_id FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  WHERE r.type = 'organization'
)
```

## Safety checks
- batches.instructor_id / instructor_2_id and studios.wingperson_id / dreamcatcher_id only reference staff IDs → no nulling needed
- No staff has any associated student record → safe to wipe `students` entirely
- Wrapped in a single transaction so partial failure rolls back

## Execution
Run the deletion via the Supabase insert/data tool (delete is a data operation, not a schema change) — no code changes, no migration.

## Files changed
None — this is a one-time data cleanup.

