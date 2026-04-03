
# Make Skipped Enrollments Clearly Visible in Import UI

## What I found
In `src/pages/Import.tsx`, the skipped rows list already exists, but it is easy to miss:
- it appears only after import
- it is hidden inside a `Collapsible`
- the trigger is a small ghost button
- the preview table only shows the first 5 CSV rows, not failed rows specifically

That matches your screenshot: you can see `144 errors`, but the actual list is visually buried.

## Plan
1. **Replace the subtle collapsible trigger with a prominent error card**
   - Show a dedicated “Skipped Enrollments” section immediately under the success/error badges
   - Use stronger visual hierarchy so it is obvious when errors exist

2. **Auto-expand skipped rows when errors are present**
   - If `result.errorMessages.length > 0`, keep the section open by default
   - No extra click needed just to discover the failures

3. **Show the failed enrollments as a readable list/table**
   - Render the full skipped-row list in a scrollable panel
   - Preserve each reason exactly, including student name / phone / unmatched cycles / batch issues
   - Add count in the header, e.g. `Skipped Enrollments (144)`

4. **Show a short preview plus full list behavior**
   - Display the first 10–20 skipped rows immediately
   - Add a “Show all” toggle if needed for very large failure lists
   - This keeps the UI readable even for 100+ errors

5. **Improve import result messaging**
   - Keep the fetched counts and created counts
   - Make the error summary easier to scan:
     - unmatched cycles
     - missing student
     - missing batch
     - duplicate / insert errors

6. **Optional quality-of-life addition**
   - Add a “Download skipped rows” CSV/text export so you can review all failed enrollments outside the app

## Files to update
- `src/pages/Import.tsx`

## Technical approach
- Replace the current `Collapsible` result block with a stronger result layout using existing UI components (`Card`, `Badge`, `Button`, `Table` or a styled list)
- Keep using `result.errorMessages` from the current import logic; no backend change is required
- If useful, parse the error strings into grouped categories for cleaner display, but keep raw messages visible too

## Expected outcome
After this change, when 144 enrollments fail:
- you will immediately see the skipped list without hunting for it
- you will be able to scroll through the failed enrollments
- you will know exactly why each enrollment was skipped
- the import screen will feel much more transparent and debuggable
