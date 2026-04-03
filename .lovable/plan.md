

# Fix Dashboard Data: Pagination + Head Count Expansion + Batch Code

## Problems
1. **Incorrect totals** — Enrollment queries use standard Supabase `.select()` which caps at 1000 rows. With 800+ enrollments, data is silently truncated. The `fetchAll` pagination helper exists in Import.tsx but is not used in Dashboard.
2. **Head Count not expandable** — It's rendered as a `SimpleCard` with no batch breakdown. Should be an `ExpandableCard` showing batch_code and unique student count per batch.
3. **Batch name vs batch_code** — The `BatchTable` displays `b.name` instead of `batch_code`. The batch_code (e.g., "Jazz3-NDA") is the standard identifier.

## Plan

### 1. Add `fetchAll` helper to Dashboard
Copy the factory-pattern `fetchAll` from Import.tsx into Dashboard (or extract to a shared util). Use it for all queries that could exceed 1000 rows:
- `enrollments` query
- `attendance` query
- `batch_sessions` query (for drop-ins)
- `drop_ins` query
- `payments` queries (if large)

### 2. Update Batch interface and query
- Add `batch_code` to the Batch interface and the batches select query
- Change `BatchTable` to display `batch_code` (or fallback to `name`) in the Batch column

### 3. Make Head Count expandable
- Replace `SimpleCard` for Head Count with `ExpandableCard`
- Add state `headCountOpen`
- Show a table in the expanded view: batch_code, unique student count per batch
- Compute a `headCountBatchData` memo that groups enrollments by batch_id and counts distinct student_ids

### 4. Studio filter for "all" still filters by batch_id
When `selectedStudio === "all"`, the enrollment query fetches ALL batches first, then filters enrollments by those batch IDs. This is correct but the `.in("batch_id", batchIds)` call may hit the URL length limit with many batches. Use fetchAll to handle this properly.

## Files Changed
- `src/pages/Dashboard.tsx` — add fetchAll, update Batch type, fix BatchTable to show batch_code, convert Head Count to ExpandableCard with per-batch unique student breakdown

