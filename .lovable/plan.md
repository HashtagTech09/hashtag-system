

# Cycle-Based Enrollment Upgrade — Phased Plan

This is a major architectural upgrade. It must be implemented in phases to avoid breaking existing data. Here is the full plan broken into implementable chunks.

## Phase 1: New Tables (Database Migration)

### 1a. `enrollment_cycles` table
```sql
CREATE TABLE public.enrollment_cycles (
  id bigint generated always as identity primary key,
  enrollment_id bigint NOT NULL,
  student_id bigint NOT NULL,
  batch_id bigint NOT NULL,
  cycle_id bigint NOT NULL,
  cycle_type text NOT NULL DEFAULT 'regular',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, batch_id, cycle_id)
);
ALTER TABLE public.enrollment_cycles ENABLE ROW LEVEL SECURITY;
-- RLS policies for authenticated + anon read/insert
```

### 1b. `cycle_adjustments` table
```sql
CREATE TABLE public.cycle_adjustments (
  id bigint generated always as identity primary key,
  student_id bigint NOT NULL,
  batch_id bigint NOT NULL,
  original_cycle_id bigint NOT NULL,
  new_cycle_id bigint,
  adjustment_type text NOT NULL, -- PAUSE_SHIFT, FREEZE_FORWARD, COMPENSATION_ADD
  reason text,
  approved_by bigint,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, APPLIED
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cycle_adjustments ENABLE ROW LEVEL SECURITY;
```

### 1c. Extend `plan_cycles` (use as `cycle_calendar`)
The existing `plan_cycles` table already has: id, start_date, end_date, plan_type (regular/grid), name, is_active, organization_id. We add:
```sql
ALTER TABLE public.plan_cycles
  ADD COLUMN sequence_no integer,
  ADD COLUMN open_for_sale boolean NOT NULL DEFAULT true;
```
No new `cycle_calendar` table needed — `plan_cycles` IS the cycle calendar.

## Phase 2: Backfill Enrollment Cycles

### 2a. Backfill script (migration)
For every existing enrollment, generate `enrollment_cycles` rows by matching the enrollment's `start_cycle_id` → `end_cycle_id` range against `plan_cycles`:
```sql
INSERT INTO enrollment_cycles (enrollment_id, student_id, batch_id, cycle_id, cycle_type)
SELECT e.id, e.student_id, e.batch_id, pc.id, pc.plan_type
FROM enrollments e
JOIN plan_cycles pc ON pc.organization_id = e.organization_id
  AND pc.start_date >= (SELECT start_date FROM plan_cycles WHERE id = e.start_cycle_id)
  AND pc.start_date <= (SELECT start_date FROM plan_cycles WHERE id = e.end_cycle_id)
WHERE e.start_cycle_id IS NOT NULL AND e.end_cycle_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

## Phase 3: New Utility Functions (`src/lib/cycleUtils.ts`)

Create shared cycle-based logic:

- **`getCurrentCycle(planCycles)`** — find cycle where today falls between start_date and end_date
- **`getEffectiveCycles(studentId, batchId, enrollmentCycles, adjustments)`** — compute effective coverage: enrollment_cycles - shifted_out + shifted_in
- **`getStudentBatchSummary(studentId, batchId, ...)`** — returns: covered_cycle_ids, first_cycle, last_cycle, current_cycle_status (ACTIVE / NOT_COVERED_BUT_FUTURE_EXISTS / EXPIRED), next_uncovered_cycle_id, has_future_coverage
- **`allocateCycles(plan, planCycles, startCycleIndex)`** — given a plan (e.g. 3R+1G), allocate the next matching cycles, skip incompatible, prevent duplicates
- **`getStudentCycleStatus(studentId, batchId)`** — determine renewal CTA: ACTIVE → no action, GAP_WITH_FUTURE_VALIDITY → ADD_GRID/ADD_REGULAR, EXPIRED → RENEW

## Phase 4: Update Enrollment Flow

### Modified files:
- **`src/pages/Enrollments.tsx`** — after creating enrollment records, also INSERT into `enrollment_cycles` for each allocated cycle
- **`src/lib/enrollmentUtils.ts`** — keep existing fee/discount logic; add `insertEnrollmentCycles()` helper
- **`src/components/register/StudentDashboard.tsx`** — same: after enrollment insert, also write enrollment_cycles

This ensures new enrollments create cycle ownership records going forward.

## Phase 5: Update Access/Attendance Logic

### `src/pages/Attendance.tsx`
Replace:
```
.lte("start_date", date).gte("end_date", date)
```
With cycle-based check:
1. Find the cycle for the session date from `plan_cycles`
2. Query `enrollment_cycles` for student+batch+cycle_id
3. Apply adjustments from `cycle_adjustments`
4. Only allow attendance if student owns that cycle (after adjustments)

## Phase 6: Student-Batch Summary View

### `src/lib/cycleUtils.ts` — `computeStudentBatchSummary()`
Aggregates across multiple enrollments to produce ONE row per student+batch with:
- covered_cycle_ids, coverage_window, current_status, next_action

### Update Admin Views:
- **`src/pages/Dashboard.tsx`** — use summary for enrollment counts (deduplicate by student+batch, not per enrollment row)
- **`src/pages/Enrollments.tsx`** (list view) — show ONE row per student+batch with merged coverage, not per enrollment record

## Phase 7: Cycle Adjustments UI

### New component: `src/components/CycleAdjustmentDialog.tsx`
Admin dialog to:
- Select student + batch
- View covered cycles
- Choose adjustment type (PAUSE_SHIFT, FREEZE_FORWARD, COMPENSATION_ADD)
- Select original_cycle_id → new_cycle_id
- Submit with reason

### Integration point:
- Accessible from student profile or enrollment detail
- When APPLIED, the effective coverage changes without modifying enrollment_cycles

## Phase 8: Student Profile UI Update

### `src/components/register/StudentDashboard.tsx`
Replace simple date-based "Active/Expired" with:
- List of covered cycles with labels
- Current cycle status badge (ACTIVE / GAP / EXPIRED)
- Next recommended action button (Renew / Add Grid / Add Regular)
- Visual indicator of missing cycles in the middle of coverage

## Files Summary

```text
NEW FILES:
  src/lib/cycleUtils.ts              — cycle logic utilities
  src/components/CycleAdjustmentDialog.tsx — pause/shift UI

MODIFIED FILES:
  src/pages/Enrollments.tsx          — write enrollment_cycles on enroll
  src/pages/Attendance.tsx           — cycle-based eligibility
  src/pages/Dashboard.tsx            — use summary, dedup display
  src/lib/enrollmentUtils.ts         — add insertEnrollmentCycles helper
  src/components/register/StudentDashboard.tsx — cycle-based profile view

MIGRATION:
  1 migration file with: enrollment_cycles table, cycle_adjustments table, plan_cycles columns, backfill query, RLS policies
```

## Important Constraints
- Existing `enrollments` table is NOT modified structurally — it remains as transaction history
- `start_date` / `end_date` on enrollments kept for backward compatibility and display only
- Cycle ownership (`enrollment_cycles`) becomes the single source of truth for access
- Multiple enrollments for same student+batch are allowed — they just add more cycle rows
- Duplicate cycle ownership prevented by UNIQUE constraint on `(student_id, batch_id, cycle_id)`

## Recommended Implementation Order
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

I recommend implementing Phases 1-4 first (tables, backfill, utilities, enrollment flow), then Phases 5-8 (access logic, summary, adjustments, profile UI) in a follow-up.

