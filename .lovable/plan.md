## Add CSV download to Enrollments

Add a **Download CSV** button in the Enrollments page toolbar that exports the currently displayed enrollments (after all active filters and sort) to a `.csv` file.

### Behavior
- Button placed next to existing filter controls in `src/pages/Enrollments.tsx`.
- Exports the `displayed` array (respects studio/batch/type/search/valid-now/valid-month filters and current sort).
- Filename: `enrollments-YYYY-MM-DD.csv` (date via `todayIST()`).
- Columns: S.No, Student Name, Phone, Studio, Batch Code, Style, Level, Type (NEW/REN/REV), Start Date, End Date, Amount, Status.
- Values properly CSV-escaped (quotes around fields, double-quote any internal quotes, handle commas/newlines).
- Pure client-side (Blob + download anchor). No backend, no new dependencies.

### Technical
- New helper in same file: `exportToCSV(rows)` builds CSV string and triggers download.
- Button uses `Download` icon from lucide-react, `variant="outline"`.
- Disabled when `displayed.length === 0`.

### Out of scope
No changes to data model, filters logic, or other pages.