## Root cause

Anvita Rastogi has 4 active enrollments (IDs 17043–17046, Jazz 4 / Hip Hop 2 / Ballet 1 / Modern 1) in the database. They show on the Dashboard but not on the Enrollments page.

The Enrollments page (`src/pages/Enrollments.tsx`, line 81) fetches active enrollments with a single Supabase query, ordered by `created_at DESC`, with no pagination. The org currently has **1,432 active enrollments**, so Supabase's default 1000-row cap silently drops the oldest ~432 rows. Anvita's enrollments fall just past that cutoff (created at 08:58:12, while row #1000 is at 08:59:02), so she disappears from the list.

This violates the project rule: queries that can exceed 1000 rows must use the paginated `fetchAll(() => queryBuilder)` helper.

## Fix

Update `src/pages/Enrollments.tsx` only:

1. Add a local `fetchAll<T>(buildQuery)` helper (same pattern as `src/pages/Import.tsx` and `src/pages/Dashboard.tsx`) that loops `.range(from, from+999)` until a short page is returned.
2. In `fetchData`, replace the single awaited enrollments query with `fetchAll(() => enrollQ)` so all active enrollments are loaded regardless of count.
3. Spot-check the other queries in `fetchData` (batches, studios, plans, plan_cycles, subscription_plan_cycles) — these are reference tables well under 1000, no change needed, but verify before shipping.

No schema, RLS, or business-logic changes. No data edits. Dashboard already paginates correctly, which is why Anvita shows there.

## Verification

- Reload `/enrollments`, search "Anvita" — 4 rows appear (Jazz 4, Hip Hop 2, Ballet 1, Modern 1).
- Total row count in the table matches `SELECT count(*) FROM enrollments WHERE organization_id=1 AND is_active=true` (1432) before filters.
- Existing filters (studio/batch/type/cycle) and CSV export still work.
