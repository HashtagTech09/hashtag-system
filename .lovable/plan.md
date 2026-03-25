

# Drop-in System with Session-Based Style Tracking

## Overview
Rebuild the drop-in system to be session-based, with style snapshots on batch_sessions for accurate fee adjustment during enrollment.

## 1. Database Changes

### Alter `batch_sessions` — add `style` column
```sql
ALTER TABLE batch_sessions ADD COLUMN style text;
```
Backfill existing rows: `UPDATE batch_sessions bs SET style = b.style FROM batches b WHERE bs.batch_id = b.id;`

### Drop and recreate `drop_ins` table
The existing `drop_ins` table uses `batch_id` + `class_date`. Replace with session-based design:

```sql
DROP TABLE IF EXISTS drop_ins;

CREATE TABLE drop_ins (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL,
  student_id bigint NOT NULL,
  batch_session_id bigint NOT NULL REFERENCES batch_sessions(id),
  amount numeric NOT NULL,
  payment_id bigint,
  is_adjusted boolean NOT NULL DEFAULT false,
  adjusted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```
RLS: authenticated full CRUD (matching existing pattern).

## 2. Session Generation — Snapshot Style

### `BatchSessionsDialog.tsx`
In `handleGenerate`, add `style: batch.style` to each row inserted into `batch_sessions`. This captures the style at generation time.

## 3. Drop-in Booking Page (`src/pages/DropIns.tsx` — new/rewrite)

### Flow
1. Select student (searchable dropdown)
2. Select batch → fetch upcoming `batch_sessions` (status = scheduled, date >= today)
3. Select a specific session (shows date, time, style)
4. Enter amount (default from `system_settings` drop-in fee)
5. Save: create payment + drop_in record with `batch_session_id`

### List View
- Show all drop-ins with student name, session date, style, amount, adjusted status
- Join through `batch_sessions` for date/style display

## 4. Enrollment Adjustment Integration (`src/pages/Enrollments.tsx`)

### During enrollment
When a student is selected and batches are chosen:

1. Query `drop_ins` where `student_id` matches, `is_adjusted = false`
2. Join with `batch_sessions` to get `session_date` and `style`
3. Filter eligible drop-ins:
   - `current_time <= session_date at 23:59:59` (same-day or future)
   - `batch_sessions.style` matches any selected batch's style
4. If eligible drop-in found (use most recent):
   - Show banner: "Drop-in available for adjustment" with session date, style, amount
   - Auto-deduct from total: `final_fee = plan_fee - drop_in.amount`
5. After successful enrollment payment:
   - Update `drop_ins` set `is_adjusted = true`, `adjusted_at = now()`

## 5. Summary of Deliverables

| # | Change | File(s) |
|---|--------|---------|
| 1 | Add `style` column to `batch_sessions`, backfill | Migration |
| 2 | Recreate `drop_ins` table (session-based) + RLS | Migration |
| 3 | Snapshot `batch.style` during session generation | `BatchSessionsDialog.tsx` |
| 4 | Rewrite Drop-ins page with session-based booking | `src/pages/DropIns.tsx` |
| 5 | Add adjustment logic during enrollment | `src/pages/Enrollments.tsx` |

