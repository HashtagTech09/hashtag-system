

# Normalize "Grid2.0" / "Grid 2.0" to match "Grid'2.0" cycles

## Problem
CSV cycle tokens like "Grid2.0" (no space) don't match DB cycle name "Grid'2.0" because:
- No exact match ("grid2.0" ≠ "grid'2.0")
- Space-normalization step only fires when there ARE spaces, so "Grid2.0" is unchanged
- Bare-name fallback checks `startsWith("grid2.0'")` which doesn't match anything

"Grid 2.0" (with space) works via step 3 (space→apostrophe), but the no-space variant fails silently.

## Solution
Add a normalization step in `matchCycleToken` that inserts an apostrophe before version-like suffixes (digits after letters). This handles both "Grid2.0" and "Grid 2.0" by trying "Grid'2.0".

In `src/pages/Import.tsx`, after step 3, add:

```typescript
// 3b. Insert apostrophe at letter-digit boundary: "Grid2.0" → "Grid'2.0"
const apostropheInserted = t.replace(/([a-zA-Z])(\d)/, "$1'$2");
if (apostropheInserted !== t) {
  match = allCycles.find(c => c.name.toLowerCase() === apostropheInserted.toLowerCase() && !usedCycleIds.has(c.id));
  if (match) { usedCycleIds.add(match.id); return match; }
}
```

This single regex covers:
- "Grid2.0" → "Grid'2.0" (matches DB)
- "Grid2" → "Grid'2" (future-proof)
- Already-apostrophed tokens like "Grid'2.0" pass via step 1 or 2

## Files Changed
- `src/pages/Import.tsx` — add apostrophe-insertion fallback in `matchCycleToken`

