## Goal
Add a "Submit" button to the Attendance page (returns to My Classes) and capture an absence reason for any student marked absent.

## Changes

### 1. Database — `attendance` table
Add nullable `absence_reason TEXT` column via migration. No RLS change needed (existing policies cover it).

### 2. `src/pages/Attendance.tsx`
- Add local state `reasons: Record<number, string>`.
- When status is set to `absent`, show an inline `Input` (placeholder "Reason for absence") under the student row. Typing debounces an update to the same attendance row (`upsert` with `absence_reason`).
- Load `absence_reason` from existing rows into `reasons` on fetch.
- Add a "Done" / "Submit" button at the bottom of the card. It just shows a success toast and calls `navigate("/instructor/home")` if the user is an instructor, otherwise navigates back (`navigate(-1)`).
- Marking present clears the reason (sets `absence_reason = null`).

### 3. `src/pages/instructor/ReportForm.tsx` (reports include absence reasons)
- Fetch today's `attendance` rows for the session's batch+date, including `absence_reason`.
- In the report form, render a read-only "Absentees" section listing absent students and their reasons (if any). No editing here — instructors enter reasons on the Attendance screen.

## Out of scope
- No changes to scoring, checklist, or ratings.
- No schema changes beyond the single nullable column.
- No analytics/manager views.
