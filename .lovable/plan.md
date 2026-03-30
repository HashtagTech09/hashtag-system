

# Use batch_code Instead of batch_name for Enrollment Import

## Problem
Two studios can have batches with the same name. Using `batch_name` alone for lookup is ambiguous.

## Solution
Replace `batch_name` with `batch_code` in the enrollment import. The `batch_code` field (e.g., "HipHop-NDA") is already unique per batch since it combines batch name + studio code.

## Changes

### `src/pages/Import.tsx`
- Change `ENROLLMENT_DB_COLUMNS`: replace `batch_name` with `batch_code`
- Update sample CSV: use `batch_code` column with examples like `HipHop-NDA`
- Update `importEnrollments` lookup: match on `batch_code` (case-insensitive) instead of `batch.name`
- Update the `batches` select query to include `batch_code` and build lookup map keyed by `batch_code`

This is a ~10-line change across 4 spots in Import.tsx.

