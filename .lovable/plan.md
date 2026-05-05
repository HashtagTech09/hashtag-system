## Add "Currently valid" filter to Enrollments

Adds a one-click filter to show only enrollments whose validity window covers today (IST).

### Behavior
- New toggle button **"Valid now"** placed next to the existing "Valid in month" picker on `/enrollments`.
- When ON: keeps only rows where `start_date <= today <= end_date` (today via `todayIST()`).
- When ON: header label shows `Currently valid — N enrollments` (parallel to the existing month label).
- Clicking again turns it OFF (back to All).
- Independent of the month picker. If both are set, both must match (AND). Turning on "Valid now" auto-clears `validMonth` to avoid confusing combinations, and vice versa.
- Plays nicely with all existing filters (studio/batch/type/search) and sort.

### Technical details (file: `src/pages/Enrollments.tsx` only)
- New state: `validNow: boolean` (default `false`).
- Import `todayIST` already present.
- In the `filtered` reducer add:
  ```ts
  let matchesValidNow = true;
  if (validNow) {
    const t = todayIST();
    matchesValidNow = e.start_date <= t && e.end_date >= t;
  }
  ```
  AND it into the return.
- Render a `Button` with `variant={validNow ? "default" : "outline"}` labeled "Valid now" in the filter row (line ~777). On click: `setValidNow(v => !v); setValidMonth("");`. Also clear `validNow` when the month picker is set.
- Extend the active-filter label block: when `validNow`, show `Currently valid — {displayed.length} enrollment(s)`.

### Out of scope
No DB changes, no business-logic changes, no changes to the New Enrollment / Add Batch flows.
