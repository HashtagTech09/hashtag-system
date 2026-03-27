# Add Attendance Report Section to Dashboard

## What

Add a new section after Revenue showing students who have missed N or more classes in the active cycle, with a configurable threshold (default 3).

## Data

- Query `attendance` table for records with `status = 'absent'` within the active cycle's date range
- Filter by studio (via batch → studio_id) if a studio is selected
- Group by `student_id`, count absences, filter where count >= threshold
- Join with `students` table for names, and `batches` for batch names

## UI (after Revenue section, ~line 506)

```text
Attendance Report
[Missed 3+ classes ▼ (number input/select to change threshold)]

┌─────────────────────────────────────────────┐
│ Student Name | Batch | Absences             │
│ John Doe     | HipHop Mon | 5               │
│ Jane Smith   | Jazz Wed   | 3               │
└─────────────────────────────────────────────┘
```

## Implementation — `src/pages/Dashboard.tsx`

1. **New state**: `missedThreshold` (default 3), `attendanceData` (array of absence records with student/batch info)
2. **New fetch** in the main `useEffect`: query `attendance` where `status = 'absent'` and `date` within active cycle range, select `student_id, batch_id, phone number` 
3. **Computed data** via `useMemo`: group by student+batch, count absences, filter by threshold, join with already-fetched `batches` and a new `students` fetch (or inline fetch for names)
4. **UI**: Section header "Attendance Report", inline number input to adjust threshold, table showing student name, batch name, absence count — sorted by most absences first. Highlight count in `ACCENT` when ≥ threshold.

## No database changes needed.