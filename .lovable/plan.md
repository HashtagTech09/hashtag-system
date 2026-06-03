## Goal
Let instructors mark attendance for a class directly from the "My Classes" (Instructor Home) view, alongside the existing "Submit Report" action.

## Changes

### 1. `src/pages/instructor/Home.tsx`
On each today's class card, add a secondary **"Mark Attendance"** button next to / above the "Submit Report" button (or the "Submitted" badge). It navigates to `/attendance?batch=<batch_id>` so the correct batch is preselected.

Layout: stack the two buttons vertically on the right side of the card so it stays clean on mobile (981px viewport already comfortable).

### 2. `src/pages/Attendance.tsx`
Read `?batch=<id>` from the URL via `useSearchParams`. When `batches` finishes loading and the param matches an allowed batch, call `setSelectedBatch(param)` once so students load automatically.

No other behavior changes — existing instructor scoping, cycle logic, and upsert flow are reused as-is.

## Out of scope
- No new attendance UI or schema changes.
- No changes to the report form or scoring.
- No manager/analytics views.
