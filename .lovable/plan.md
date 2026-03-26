

# Add `previous_batch_id` to Enrollments

## Purpose
Track which batch a student was previously enrolled in, enabling renewal/revival rate calculations per batch. Even if a student switches batches, the **previous batch** gets credit for the renewal/revival.

## Database Migration
Add a nullable `previous_batch_id` column to the `enrollments` table:

```sql
ALTER TABLE public.enrollments ADD COLUMN previous_batch_id bigint;
```

No foreign key needed (consistent with existing pattern — no FKs on this table).

## Code Changes — `src/pages/Enrollments.tsx`

### 1. Fetch previous batch IDs during status detection
When detecting REN/REV status (the `detectStatus` effect around line 64), also fetch the `batch_id` values from the student's most recent enrollment set. Store them in new state `previousBatchIds`:

```ts
const [previousBatchIds, setPreviousBatchIds] = useState<number[]>([]);
```

Query: fetch all enrollments for the student with the latest `end_date` to get the batch IDs they were last enrolled in.

### 2. Set `previous_batch_id` on new enrollment records

**New Enrollment (`handleEnroll`, ~line 262)**:
- If `detectedStatus` is `"NEW"` → set `previous_batch_id: null`
- If `detectedStatus` is `"REN"` or `"REV"` → for each new batch, pick the matching previous batch if it exists in `previousBatchIds`, otherwise use the first previous batch ID (or null if none)

Logic: map each new `batch_id` — if it matches a previous batch, use that. Otherwise assign the first previous batch ID so the old batch still gets renewal credit.

**Add Batch (`handleAddBatch`, ~line 397)**:
- These are always `"REN"` status. The `previous_batch_id` should be `null` since the student is adding a new batch (not renewing from a previous one). Or optionally set to the same batch if it existed before — but since add-batch only allows **new** batches not already enrolled, `previous_batch_id` should be `null`.

### 3. Display (optional)
No UI changes needed now — this is primarily a data-tracking column for analytics.

## Summary
- 1 migration: add `previous_batch_id` column
- 1 file edit: `src/pages/Enrollments.tsx` — fetch previous batches on status detect, include in enrollment insert records

