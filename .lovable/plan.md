# Auto-Mark Past Sessions as Completed

## Overview

Automatically set `status` to `completed` for any session whose `session_date` is before today. This runs on the backend via a scheduled function so it happens without user interaction.

## Approach: Scheduled Backend Function

Create a backend function that runs daily (via pg_cron) to bulk-update past sessions.

### 1. Backend Function (`supabase/functions/mark-completed-sessions`)

- Simple function that runs: `UPDATE batch_sessions SET status = 'completed' WHERE session_date < CURRENT_DATE AND status = 'scheduled'`
- Only updates `scheduled` sessions (leaves cancelled/holiday/sold_out untouched)

### 2. Schedule via pg_cron

- Run the update daily at midnight UTC
- Uses `pg_cron` + `pg_net` to invoke the edge function on schedule

### 3. Frontend Fallback

- In `BatchSessionsDialog.tsx` and `SessionCalendarView.tsx`, when fetching sessions, also run a quick client-side check: if any loaded session has `session_date < today` and `status = 'scheduled'`, fire a batch update to mark them completed
- This ensures immediate correctness even if the cron hasn't run yet

## Summary of Changes

1. **Edge function**: `mark-completed-sessions` — updates past scheduled sessions to completed
2. **pg_cron job**: Scheduled daily invocation
3. **Frontend**: On session fetch, opportunistically mark overdue sessions as completed
4. UI Change : don't show/ hide the completed session in the interface 