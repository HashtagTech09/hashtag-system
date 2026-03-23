

# Support Per-Day Timings for Batches

## Problem
Currently batches have a single `start_time` and `end_time` applied to all days. In reality, a batch might run Mon 6-7pm and Wed 7-8pm — different timings per day.

## Approach
Replace the flat `days`, `start_time`, `end_time` columns with a structured `schedule` JSONB column that stores per-day timing.

## Database Migration

1. **Add `schedule` column** to `batches` (jsonb, nullable)
   - Format: `[{"day": "Mon", "start_time": "18:00", "end_time": "19:00"}, {"day": "Wed", "start_time": "19:00", "end_time": "20:00"}]`
2. **Migrate existing data**: Convert current `days` + `start_time`/`end_time` into the new schedule format
3. **Drop** `days`, `start_time`, `end_time` columns

## Frontend Changes (`src/pages/Batches.tsx`)

### Form
- Replace the current days toggle + single time inputs with a dynamic schedule builder:
  - Click a day badge to add it to the schedule
  - Each selected day gets its own start/end time row
  - Removing a day removes its time row
- Example UI:
```text
Days & Schedule:
[Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]

  Mon:  [18:00] - [19:00]  ✕
  Wed:  [19:00] - [20:00]  ✕
```

### Table Display
- "Days" column: show day badges (extracted from schedule)
- "Time" column: show per-day times, e.g. `Mon 18:00-19:00, Wed 19:00-20:00`

### Save Logic
- Build the schedule JSON array from the form state and save to `schedule` column

### Edit Prefill
- Parse `schedule` JSON back into the per-day form state

## Attendance Page Impact
- Update `Attendance.tsx` to read days from `schedule` instead of `days` array (for any day-based filtering if needed)

## Technical Details
- Form state changes from `{ days: string[], start_time, end_time }` to `{ schedule: Array<{day: string, start_time: string, end_time: string}> }`
- JSONB gives flexibility without needing a separate `batch_schedules` table

