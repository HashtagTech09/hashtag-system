# Auto-Attendance in Report Form

## Goal
On the instructor Report Form, replace the manual "Students Present" input with an auto-computed `present / total` derived from the attendance marked for that batch + date. Enhance the Absentees list to show name, Call and WhatsApp buttons, and the reason captured during attendance.

## Changes (frontend only — `src/pages/instructor/ReportForm.tsx`)

1. **Fetch full attendance roster** for `batch_id` + `session_date`:
   - Query `attendance` joined with `students(name, phone, users(phone))` for the session — both `present` and `absent` rows.
   - Compute `presentCount` and `totalCount` (= rows with status set).
   - Build `absentees` array with `{ name, phone, reason }` using the same phone fallback as elsewhere (`getDisplayPhone`).

2. **Replace Students Present input** with a read-only summary card:
   - Display `X / Y` (e.g. `5 / 10`) prominently with label "Students Present".
   - If no attendance has been marked yet, show a helper line: "Mark attendance first" with a link/button to `/attendance?batch={batch_id}`.
   - Submit payload uses the auto-computed `presentCount` for `students_present` (number). Validation requires at least one attendance row to exist.

3. **Enhanced Absentees list** — each row shows:
   - Student name
   - Reason (or "No reason given" placeholder) — editable inline by instructor via an `Input`; on blur, upsert `attendance.absence_reason` for that student/batch/date (same pattern as `Attendance.tsx`).
   - Two icon buttons on the right:
     - Call → `<a href="tel:{phone}">` with Phone icon
     - WhatsApp → `<a href="https://wa.me/{normalizedPhone}" target="_blank">` with MessageCircle icon
   - Buttons hidden if no phone available.

4. **Keep existing behaviour** for ratings, checklist, choreography upload, notes, sticky submit.

## Out of scope
- No DB schema changes (column `absence_reason` already exists).
- No changes to `Attendance.tsx`, scoring, analytics, or manager views.
- No removal of the existing absentees section — it's extended in place.
