

# Debug & Harden Grid2.0 Cycle Matching

## Analysis
The apostrophe-insertion code at line 505 (`t.replace(/([a-zA-Z])(\d)/, "$1'$2")`) is correct and should transform "Grid2.0" → "Grid'2.0" which matches the DB. The DB value uses a plain ASCII apostrophe (verified via hex encoding).

Possible causes for the continued failure:
1. The CSV token may contain invisible Unicode characters (zero-width spaces, BOM, etc.)
2. The deployed preview may not yet include the latest fix
3. A curly/smart quote in the CSV data

## Solution
Add more aggressive normalization at the **start** of `matchCycleToken` to strip non-printable characters and normalize all quote-like characters to a plain ASCII apostrophe. Also add a debug log so unmatched tokens show exactly what was attempted.

### Changes in `src/pages/Import.tsx`

1. **Sanitize token on entry** — at the top of `matchCycleToken`, strip zero-width chars and normalize smart quotes:
```typescript
// Sanitize: remove zero-width chars, normalize smart quotes
let t = token.trim().replace(/[\u200B-\u200D\uFEFF]/g, "");
t = t.replace(/[\u2018\u2019\u2032\u02BC]/g, "'"); // curly quotes → ASCII apostrophe
```

2. **Add the attempted variants to the error message** — when a token is unmatched, include what normalizations were tried, so the user can see exactly why it failed:
```typescript
// In the error message, show the raw token
unmatchedTokens.push(`${token} [raw: ${JSON.stringify(token)}]`);
```

This way, next time the import runs, you will either see it match correctly (because the fix is now deployed) or get diagnostic info showing the exact characters in the failing token.

## Files Changed
- `src/pages/Import.tsx` — add Unicode sanitization at top of `matchCycleToken`, add raw token info to error messages

