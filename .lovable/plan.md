

# Generate Class Sessions (Slots) from Batch Schedules

## Overview
Create a `batch_sessions` table that stores individual class instances generated from a batch's recurring schedule for a given date range. Each session represents one specific class occurrence (e.g., "Hip Hop Beginners — Mon Jan 6, 6:00-7:00 PM"). These sessions become the foundation for attendance tracking, future booking, and reporting.

## Database Migration

### New table: `batch_sessions`
```sql
CREATE TABLE public.batch_sessions (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL REFERENCES public.organizations(id),
  batch_id bigint NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  day text NOT NULL,           -- "Mon", "Tue", etc.
  start_time text NOT NULL,    -- "18:00"
  end_time text NOT NULL,      -- "19:00"
  status text NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, session_date, start_time)
);
```
RLS: authenticated full CRUD (matching current pattern).

## Frontend: Session Generation UI

### On the Batches page
- Add a **"Generate Sessions"** button (per batch or bulk)
- Clicking opens a dialog to pick a **date range** (e.g., "Jan 1 – Jan 31")
- System reads the batch's `schedule` JSONB, iterates each date in range, matches day-of-week, and inserts one `batch_session` row per match
- Shows a preview of how many sessions will be created before confirming

### New "Sessions" view (inside Batches page or as a sub-tab)
- List all generated sessions for a selected batch
- Columns: Date, Day, Time, Status
- Allow cancelling individual sessions (sets status to `cancelled`)

## Generation Logic (Frontend)
```text
For each date in [start_date, end_date]:
  dayName = getDayName(date)  // "Mon", "Tue"...
  For each entry in batch.schedule where entry.day === dayName:
    Insert batch_session(batch_id, date, day, start_time, end_time)
```

## Attendance Integration (Future-ready)
- Currently attendance links to `batch_id` + `date`. Once sessions exist, attendance can optionally reference `session_id` for precise tracking
- No change to attendance table now — this is additive

## Summary of Changes
1. **Migration**: Create `batch_sessions` table with RLS
2. **Batches page**: Add "Generate Sessions" button + date range dialog + generation logic
3. **Sessions list**: Show generated sessions per batch with status management

