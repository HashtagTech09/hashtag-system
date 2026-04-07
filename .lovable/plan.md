

# Fix: Match "Grid2.0" / "Grid 2.0" to "Grid'2.0'26"

## Problem
The DB cycle name is `Grid'2.0'26`. CSV tokens like `Grid2.0` or `Grid 2.0` get normalized to `Grid'2.0` (via steps 3/3b), but that doesn't exactly match `Grid'2.0'26`. The bare-name fallback (step 4) only runs on the **original** token, not on the normalized variants, so it never tries `startsWith("grid'2.0")`.

## Fix
After steps 3 and 3b produce a normalized token that still doesn't match exactly, also run the bare-name `startsWith` fallback using the normalized value. This way `Grid'2.0` will match `Grid'2.0'26`.

### Changes in `src/pages/Import.tsx` — `matchCycleToken`

After the apostrophe-insertion step (line ~511), add a bare-name fallback for the normalized variants:

```typescript
// 3c. Bare-name fallback on normalized variants
for (const variant of [spaceNormalized, apostropheInserted]) {
  if (variant === t) continue;
  const vLower = variant.toLowerCase();
  match = allCycles.find(c => {
    const cLower = c.name.toLowerCase();
    return (cLower.startsWith(vLower + "'") || cLower.startsWith(vLower + " ") || cLower === vLower) && !usedCycleIds.has(c.id);
  });
  if (match) { usedCycleIds.add(match.id); return match; }
}
```

This handles:
- `Grid2.0` → normalized to `Grid'2.0` → matches `Grid'2.0'26` via startsWith
- `Grid 2.0` → normalized to `Grid'2.0` → same match
- Any future similar patterns (e.g., `Grid3.0` → `Grid'3.0'27`)

## Files changed
- `src/pages/Import.tsx` — add bare-name fallback for normalized variants inside `matchCycleToken`

