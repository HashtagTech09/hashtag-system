

# Fix fetchAll to Use Query Builder Factory

## Problem
The current `fetchAll` receives a single query builder instance and calls `.range()` on it repeatedly. Supabase's PostgREST query builder may not reliably re-execute after the first `await` — the AbortController or internal state can prevent subsequent fetches from working. This means only the first 1000 rows are ever returned, silently dropping the rest.

## Solution
Change `fetchAll` to accept a **factory function** `() => queryBuilder` instead of the builder itself. Each page iteration creates a fresh builder, guaranteeing a clean HTTP request.

### Updated helper
```typescript
async function fetchAll<T>(buildQuery: () => any): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}
```

### Updated call sites (~12 locations)
Change every call from:
```typescript
fetchAll(supabase.from("users").select("id, phone").eq("organization_id", ORG_ID))
```
To:
```typescript
fetchAll(() => supabase.from("users").select("id, phone").eq("organization_id", ORG_ID))
```

### Add fetch count logging
After each `fetchAll`, log the count to the import result so the user sees: "Fetched 801 users, 820 students, 24 batches, 12 cycles" — confirming the limit is bypassed.

## Files Changed
- `src/pages/Import.tsx` — update `fetchAll` signature and all ~12 call sites to use factory pattern; add fetch count info to result messages
