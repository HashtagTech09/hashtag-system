# Dashboard Revamp

## Overview

Replace the current placeholder dashboard with a comprehensive analytics view filtered by studio (or all studios). Uses company terminology: "Dreams" = enrollments.

## Layout

```text
┌─────────────────────────────────────────────────┐
│ [Studio Filter: All / Studio1 / Studio2 / ...]  │
├─────────────────────────────────────────────────┤
│ KPI Cards Row                                   │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐│
│ │Total     │ │Head      │ │New Dreams│ │REV   ││
│ │Dreams    │ │Count     │ │vs Target │ │Dreams││
│ │vs Target │ │(students)│ │          │ │      ││
│ └──────────┘ └──────────┘ └──────────┘ └──────┘│
│ ┌──────────┐ ┌──────────┐                       │
│ │REN Dreams│ │Total     │                       │
│ │vs Renew- │ │Renewable │                       │
│ │able      │ │          │                       │
│ └──────────┘ └──────────┘                       │
├─────────────────────────────────────────────────┤
│ Batch-wise Dreams (Expandable)                  │
│ Batch Name | Enrolled | Capacity (35)  | %Fill  │
├─────────────────────────────────────────────────┤
│ Date-wise Breakdown Table                       │
│ Date | NEW | REN | REV | Drop-In | DI Adjusted │
│      | Gross | GST | Total | Cash | Razorpay    │
└─────────────────────────────────────────────────┘
```

## Data Queries (all filtered by active cycle + optional studio)

1. **Active cycle**: Find current `plan_cycle` where `is_active = true`
2. **Total Dreams**: Count enrollments in active cycle, compare to a target (stored in `system_settings` as `dream_target_{studio_id}` or overall)
3. **Head Count**: Count distinct `student_id` from enrollments in active cycle
4. **New Dreams**: Count enrollments where `status_type = 'NEW'`
5. **REV Dreams**: Count enrollments where `status_type = 'REV'`
6. **REN Dreams vs Renewable**:
  - REN count: enrollments where `status_type = 'REN'`
  - Renewable count: students whose previous enrollment `end_date` falls within the active cycle period (expired or in grace)
7. **Batch-wise**: Group enrollments by `batch_id`, show count vs capacity (35)
8. **Date-wise**: Group by `created_at::date`, pivot by `status_type`, join `payments` for amounts by mode
9. **Studio filter**: When a studio is selected, filter batches by `studio_id`, then filter enrollments by those `batch_id`s

## File Changes

### `src/pages/Dashboard.tsx` — Full rewrite

- Studio filter dropdown at top (fetches from `studios` table)
- KPI cards section with actual/target display
- Collapsible batch-wise enrollment table
- Date-wise breakdown table with payment details

### Database: Add target settings

Use `system_settings` to store targets per studio per cycle:

- Key format: `dream_target`, `new_dream_target`, value is the number
- For now, hardcode sensible defaults or allow inline editing later

## Technical Details

- All queries scoped to `organization_id = 1` and the active cycle's date range
- Studio filter: "All" shows org-wide aggregates; specific studio filters `batches.studio_id`
- Batch capacity hardcoded to 35 per the requirement
- Payment breakdown: join `payments` via `enrollments.payment_id`, group by `payment_mode` (cash/razorpay)
- Drop-in data: query `drop_ins` table, separate adjusted vs unadjusted
- No new database tables needed — all data exists
- Add graphs wherever suitable and use #ff07f to highlight important metic 