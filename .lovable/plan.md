

# Add Cycle Filter to Dashboard + Filters to Enrollments

## Dashboard: Cycle Selector

Currently the Dashboard hardcodes the active cycle (`is_active = true`). We'll add a cycle dropdown so you can view data for any past or current cycle.

### Changes in `src/pages/Dashboard.tsx`
1. **Fetch all plan_cycles** (not just active) on init, store in `allCycles` state
2. **Add a cycle selector** next to the existing studio filter — defaults to the active cycle
3. **Replace `activeCycle`** usage with `selectedCycle` (driven by the dropdown). All enrollment queries, C/F logic, date-wise breakdowns, etc. use this selected cycle instead of the hardcoded active one
4. The studio filter remains as-is, working in combination with the cycle filter

## Enrollments: Batch, Studio, Type Filters

Currently the Enrollments page only has a text search. We'll add three filter dropdowns.

### Changes in `src/pages/Enrollments.tsx`
1. **Add state** for `filterBatchId`, `filterStudioId`, `filterType` (all default to `"all"`)
2. **Fetch studios** on init (already have batches)
3. **Add three Select dropdowns** in the filter bar:
   - **Studio** — filter by batch's `studio_id`
   - **Batch** — filter by `batch_id` (list filtered by selected studio if one is chosen)
   - **Type** — filter by `status_type` (NEW / REN / REV)
4. **Update `filtered`** to chain all filters: search + studio + batch + type

## Files changed
- `src/pages/Dashboard.tsx` — fetch all cycles, add cycle selector dropdown, use selected cycle for all data
- `src/pages/Enrollments.tsx` — add studio/batch/type filter state + dropdowns, update filter logic

