

# Update Base Prices for Enrollment Pricing

## Change
Update the hardcoded base prices in `src/pages/Enrollments.tsx`:
- Regular cycle: `3220` → `3767`
- Grid cycle: `7000` → `5300`

## Files
**`src/pages/Enrollments.tsx`** — two locations (line ~231 and ~386):
- `computeFeeBreakdown()`: change `3220` to `3767` and `7000` to `5300`
- `computeAddBatchFee()`: change `3220` to `3767` and `7000` to `5300`

No database changes needed.

