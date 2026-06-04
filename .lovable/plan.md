## Goal

Make the **"Valid in month"** filter on `/enrollments` use the same cycle-ownership logic the Dashboard uses, so the two pages can never disagree about which enrollments belong to a given month.

Today they disagree because:

- **Dashboard** (`src/pages/Dashboard.tsx` ~L145–194): date-window prefilter THEN intersect with `enrollment_cycles` ± `cycle_adjustments` for that specific cycle id. Accurate per Regular/Grid cycle.
- **/enrollments "Valid in month"** (`src/pages/Enrollments.tsx` L633–640): date-window overlap only. A 6-month Regular plan that spans a Grid month falsely shows up under that Grid month; an enrollment whose cycle was shifted out via `cycle_adjustments` still shows up; and (until the /register fix lands and backfill runs) enrollments missing `enrollment_cycles` look fine here but vanish from the dashboard.

"Valid now" stays as-is (it's about today's date, not a specific plan cycle).

## Scope

Only the month filter on `/enrollments`. The "active enrollments" default list (no month picked) keeps using `is_active` — that's intentional because it's a records list, not a per-month view.

## Implementation

### 1. New helper: `getEnrollmentsValidInCycle`

Add to `src/lib/cycleUtils.ts`:

```ts
export async function filterEnrollmentsByCycle(
  enrollments: { id: number; student_id: number; batch_id: number }[],
  cycleId: number
): Promise<Set<number>>  // returns the set of enrollment ids that own cycleId
```

Behavior mirrors Dashboard L155–193:
- Fetch `enrollment_cycles` for the given enrollment ids (paginated via `fetchAll`).
- Fetch `cycle_adjustments` (status=APPLIED) for those `(student_id, batch_id)` pairs.
- Build `owns` / `shiftedOut` / `shiftedIn` sets keyed by `student_id:batch_id`.
- Return the set of enrollment ids where `(owns && !shiftedOut) || shiftedIn`.

This is the single source of truth — Dashboard will be refactored to use it too (small follow-up inside the same change set, no behavior change).

### 2. Map "month" → cycle id on `/enrollments`

The current `validMonth` state is a `YYYY-MM` string. Convert it to a cycle picker that resolves to a `plan_cycles.id`:

- Keep the existing `<Input type="month" />` UI.
- When the user picks a month, look up the matching `plan_cycles` row for org 1 where `start_date <= monthEnd AND end_date >= monthStart`. If multiple cycles fall in the same month (Regular + Grid both can), show a small follow-up select so the user picks which cycle — defaulting to the Regular one. Store `validCycleId` in state.
- Add the picked cycle's name (e.g. "Grid'26") to the active-filters chips so it's obvious which cycle is being filtered.

`planCycles` is already loaded on this page, so no extra fetch is needed for the lookup.

### 3. Apply the filter

Replace the date-window block in `Enrollments.tsx` L633–640 with:

- If `validCycleId` is set, run `filterEnrollmentsByCycle(enrollments, validCycleId)` once per fetch (memoized in a `useEffect` that depends on `enrollments` + `validCycleId`) and store the resulting `Set<number>`.
- `matchesMonth = validCycleId ? validEnrollmentIds.has(e.id) : true`.

Show a loading state on the table while the cycle filter resolves.

### 4. Refactor Dashboard to call the same helper

Replace the inline block in `Dashboard.tsx` L155–193 with a call to `filterEnrollmentsByCycle(enrollRaw, selectedCycle.id)` and `enrollList = enrollRaw.filter(e => validIds.has(e.id))`. Pure refactor, no behavior change.

## Files changed

- `src/lib/cycleUtils.ts` — add `filterEnrollmentsByCycle`.
- `src/pages/Enrollments.tsx` — replace date-window month filter with cycle-id filter; add cycle resolver on month pick; add cycle chip.
- `src/pages/Dashboard.tsx` — call the new helper instead of the inline block.

## Out of scope

- "Valid now" filter (still a date check — fine).
- Default "active enrollments" listing.
- Backfilling enrollments missing `enrollment_cycles` — covered by the previous fix and its migration.
- Server-side filtering. We still pull active enrollments client-side and filter; same as Dashboard.

## Verification

1. Pick **Grid'26** month on `/enrollments` → Jaanvi Goel appears (post-backfill). A pure Regular plan spanning Jan'26 does NOT appear under Grid'26.
2. Same month on Dashboard shows the same student set for the same studio/batch scope.
3. An enrollment with an APPLIED `cycle_adjustment` shifting it OUT of the picked cycle is excluded on both pages; one shifted IN is included on both.
4. With no month picked, `/enrollments` still shows all active enrollments (unchanged).
