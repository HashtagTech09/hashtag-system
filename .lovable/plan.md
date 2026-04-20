

## Remove all non-staff enrollments

Since the prior cleanup, the system has accumulated **36 enrollments** and **139 enrollment cycles** — all from non-staff students (0 belong to staff). Easy wipe.

### What gets deleted
| Table | Rows |
|---|---|
| enrollment_cycles | 139 |
| enrollments | 36 |

### What gets kept
- All 14 staff users + their `user_roles` (untouched)
- All 828 students (untouched — only their enrollments are removed)
- Batches, studios, plan cycles, subscription plans, system settings (untouched)

### Empty tables (nothing to do)
payments, payment_allocations, pending_enrollments, cycle_adjustments, drop_ins, drop_in_credits, attendance, cash_payment_requests

### Deletion order (respects references)
```text
1. enrollment_cycles  → references enrollments
2. enrollments        → final
```

### SQL (single transaction via insert/data tool)
```sql
DELETE FROM enrollment_cycles;
DELETE FROM enrollments;
```
(No filter needed — every row is non-staff.)

### Files changed
None — one-time data cleanup.

