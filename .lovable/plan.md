# Merge duplicate Jazz2-RG batches

Two batches exist with the same `batch_code = "Jazz2-RG"` (Rohini Galleria studio, Jazz Level 2):

| Keep | id | name | instructor_id | enrollments | enrollment_cycles |
|---|---|---|---|---|---|
| ✅ Keep | **46** | Jazz 2 | 14 | 19 | 39 |
| ❌ Merge & delete | **90** | Jazz 2 | 31 | 4 | 15 |

## What changes

Repoint all data on batch **90** to batch **46**, then delete batch 90. Only these tables hold references to either batch:

- `enrollments.batch_id`: 4 rows → 46
- `enrollment_cycles.batch_id`: 15 rows → 46

(Verified no rows in `attendance`, `batch_sessions`, `payment_allocations`, `cycle_adjustments`, `application_cases`, or `enrollments.previous_batch_id` reference 46 or 90.)

## Steps

1. `UPDATE enrollments SET batch_id = 46 WHERE batch_id = 90;`
2. `UPDATE enrollment_cycles SET batch_id = 46 WHERE batch_id = 90;`
3. `DELETE FROM batches WHERE id = 90;`

Batch 46 retains its existing instructor (id 14). No UI/code changes required — the dashboard will automatically show a single Jazz2-RG row after the merge.

## Confirm before I run

- Keep id **46** (instructor 14), delete id **90** (instructor 31) — correct?
- If the instructor on the surviving batch should instead be 31 (or both), say so and I'll add that update.
