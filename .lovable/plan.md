

# Fix Cycle Token Matching for Bare Names

## Problem
CSV cycle tokens like `April`, `May`, `Grid`, `Grid 2.0` don't match DB names like `April'26`, `May'26`, `Grid'26`, `Grid'2.0`. The current matcher only handles tokens WITH year suffixes, not bare tokens that need to find suffixed DB names.

## Solution
Enhance `matchCycleToken` in `src/pages/Import.tsx` to add a fallback: when no direct or year-suffix match is found, check if any cycle name starts with the token as a base. If multiple matches exist (e.g., `April'26` and `April'27`), pick the earliest unmatched one.

### Updated matching logic (pseudocode)
```
1. Direct match (exact, case-insensitive) — existing
2. Year-suffix on token ("January'27") — existing  
3. NEW: Bare token fallback
   - "April" → find cycles whose name starts with "April" (e.g., April'26, April'27)
   - "Grid" → find cycles starting with "Grid" (e.g., Grid'26)
   - "Grid 2.0" → find cycles matching "Grid'2.0" or "Grid 2.0"
   - Return first match (by start_date order, already sorted)
4. NEW: Normalize special cases
   - "Grid 2.0" → also try "Grid'2.0"
```

### Duplicate prevention
Since the same base name could match multiple cycles (e.g., April'26 and April'27), track which cycle IDs have already been matched in the outer loop and skip them. This ensures `April` in the CSV maps to `April'26` and `April'27` maps correctly when explicitly suffixed.

## Files Changed
- `src/pages/Import.tsx` — enhance `matchCycleToken` with bare-name fallback and add a `usedCycleIds` Set to prevent double-matching

