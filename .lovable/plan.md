## Changes to `src/pages/instructor/ReportForm.tsx`

1. **Reorder sections** — Move the `Absentees` block to appear directly under the `Students Present` summary card, before `ChecklistToggles`. Order becomes:
   - Session info card
   - Students Present (with Mark Attendance / Edit button)
   - Absentees
   - Checklist
   - Ratings
   - Choreography Video
   - Notes
   - Sticky Submit bar

2. **Restyle Mark Attendance / Edit button** — Replace the current plain `variant="outline"` button with a hot-pink outlined button to contrast against the solid primary Submit Report button:
   - Classes: `border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold`
   - Add a `ClipboardCheck` (or similar) icon before the label for clarity
   - Keep size `sm`, keep both label states ("Mark Attendance" / "Edit")

No backend, schema, or logic changes — purely presentational reorder + button styling.
