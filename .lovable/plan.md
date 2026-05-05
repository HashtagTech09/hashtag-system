## Enrollments page enhancements

Add three small UI features to `/enrollments`:

### 1. Serial number column
- Add a leftmost `#` column showing 1, 2, 3… based on the current filtered/sorted list order.

### 2. Sort dropdown
New `Select` next to existing filters with options:
- **Newest first** (default — current behavior, by `created_at` desc)
- **Oldest first**
- **Name A–Z** (by `students.name`)
- **Name Z–A**
- **End date (soonest)**
- **End date (latest)**

Sorting applied client-side on the already-filtered list.

### 3. "Valid in month" filter
New month picker (native `<input type="month">` styled to match) with:
- Default: **All** (no filter)
- When a month like `2026-05` is picked, keep only enrollments whose validity window overlaps that month — i.e. `start_date <= last day of month` AND `end_date >= first day of month`.
- A small "Clear" link to reset to All.

Label shown above table: "Valid students for May 2026 — N enrollments" when active.

### Technical details
- File touched: `src/pages/Enrollments.tsx` only.
- New state: `sortBy: string`, `validMonth: string` (YYYY-MM).
- Compute `displayed = sortAndFilterByMonth(filtered)` once per render; pass to table; index gives S.No.
- Use `date-fns` `startOfMonth`/`endOfMonth` (already imported via `parseISO`; add these two imports).
- Update the table `colSpan` from 10 to 11 for the empty state.
- No DB / business-logic changes. No changes to renewal flow.
