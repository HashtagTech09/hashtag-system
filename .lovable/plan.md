

# Fix 1000-Row Limit in Import + Show Skipped Enrollments

## Problem
Supabase returns max 1000 rows by default. With 801 users and 820 students, queries like `supabase.from("users").select(...)` silently truncate results. This means some students/users aren't found during import, causing enrollments to be skipped without clear reporting.

## Solution

### 1. Add a paginated fetch helper
Create a `fetchAll` utility function that fetches in pages of 1000 using `.range()` until all rows are returned. Use this for every reference-data query in the import functions.

```typescript
async function fetchAll<T>(query: any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
```

### 2. Replace all `.select()` calls in import functions
Update every reference-data fetch in `importUsers`, `importStudents`, `importEnrollments`, and `importSmartEnrollments` to use `fetchAll` instead of direct `.select()`. This affects roughly 10 query sites.

### 3. Show skipped enrollment details
After import completes, display the error messages list (already collected as `errorMessages[]`) more prominently. Currently the toast only shows counts. Add a collapsible "Skipped Rows" section below the import results that lists each skipped row with the reason (e.g., "No student for: Harshveer / 9876543210", "No batch with code: Jazz3-NDA").

## Technical Detail
- The `fetchAll` helper rebuilds the query for each page using `.range(from, to)` — this requires passing a query builder (before `.range()` is called), not the executed result.
- Pattern: `fetchAll(supabase.from("users").select("id, phone").eq("organization_id", ORG_ID))`

## Files Changed
- `src/pages/Import.tsx` — add `fetchAll` helper, replace ~10 query sites, add skipped-rows display in UI

