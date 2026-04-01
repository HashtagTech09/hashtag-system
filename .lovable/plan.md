

# Smart Enrollment Import — Batch Code & Cycle Name Resolution

## Format
CSV columns: `Name | Phone | Email | Style Level | Studio Code | Cycles (comma-separated)`

Example row: `Parnika Goel | 9811401934 | garg.sakshi08@gmail.com | Jazz 3 | NDA | April, May, Grid, July, August, September, October, Grid 2.0, January'27, February'27, March'27, April'27`

## Batch Code Parsing Rules

The `style_level` column is converted to a `batch_code` by removing spaces and appending `-{studio_code}`:

| Input | batch_code | style_base | level |
|-------|-----------|------------|-------|
| Jazz 3 | Jazz3-NDA | Jazz | Level 3 |
| Jazz1.1 | Jazz1.1-NDA | Jazz | Level 1 |
| Jazz2.1 | Jazz2.1-NDA | Jazz | Level 2 |
| Hip Hop 2 | HipHop2-NDA | Hip Hop | Level 2 |
| Ballet 1 | Ballet1-NDA | Ballet | Level 1 |

**Rule**: The integer part before any decimal determines the level number. "Jazz1.1" → integer part is 1 → Level 1. "Jazz2.1" → integer part is 2 → Level 2.

## Cycle Name Matching

Comma-separated cycle tokens are matched against `plan_cycles.name`:
- Direct match: "April" → plan_cycle named "April"
- Year suffix: "January'27" → try "January'27", then "January 27", then just "January"
- Grid cycles: "Grid", "Grid 2.0" → match cycles with `plan_type = "grid"`

Validity dates derived from first and last matched cycle's `start_date`/`end_date`.

## Plan Auto-Detection

Count regular vs grid cycles in the comma list, find matching `subscription_plans` by `total_regular_cycles` and `total_grid_cycles`.

## Changes — `src/pages/Import.tsx`

### 1. Add new "Smart Enrollments" tab
New DB columns for mapping:
```typescript
const SMART_ENROLLMENT_COLUMNS = [
  "student_name", "student_phone", "student_email",
  "style_level", "studio_code", "cycles"
] as const;
```

### 2. `importSmartEnrollments` function
- Parse `style_level` + `studio_code` → `batch_code` (remove spaces, append `-{code}`)
- Look up batch by `batch_code` in batches table
- Split `cycles` by comma, match each token to `plan_cycles` rows
- Derive `start_date` (first cycle), `end_date` (last cycle)
- Auto-detect subscription plan from regular/grid cycle counts
- Auto-create users + students (same as existing enrollment import)
- Insert enrollment + enrollment_cycles for each matched cycle
- Show clear errors for unmatched batch codes or cycle names

### 3. Batch code builder helper
```typescript
function buildBatchCodeFromInput(styleLevel: string, studioCode: string): string {
  // "Jazz 3" + "NDA" → "Jazz3-NDA"
  // "Hip Hop 2" + "NDA" → "HipHop2-NDA"
  const noSpaces = styleLevel.replace(/\s+/g, '');
  return `${noSpaces}-${studioCode.trim()}`;
}
```

### 4. Sample CSV updated for the new tab

### 5. Preview shows resolved batch_code and matched cycle count before import

## Files Changed
- `src/pages/Import.tsx` — add Smart Enrollments tab with new parsing logic

