## Goal

Every registration made through `/register` (Razorpay or Cash) should populate `enrollment_cycles` so the student appears on the dashboard for every cycle their plan covers. Also backfill the 33 existing enrollments missing these rows.

## Root cause recap

- `src/components/register/JoinBatchFlow.tsx` builds the Razorpay payload with `enrollment_cycles_template: []` and stores the cash request with no template at all.
- `supabase/functions/razorpay-webhook/index.ts` only inserts cycles when the template is non-empty, so Razorpay registrations create enrollments with zero `enrollment_cycles`.
- `src/pages/ConfirmCash.tsx` never references `enrollment_cycles`, so cash confirmations have the same gap.

Result: 33 active enrollments (all `status_type='NEW'`, including Jaanvi Goel on Grid'26) are invisible to the dashboard.

## Fix — three parts

### 1. Compute the cycles template in `JoinBatchFlow.tsx`

In `handleEnroll`, before building the Razorpay / cash payloads:

- Use the already-loaded `plan` (from `selectedPlanId`), `planCycles`, and `assignment.startCycle` to derive `startCycleIndex` (find its index in `planCycles`).
- Call `allocateCyclesForPlan(plan, planCycles, startCycleIndex)` from `@/lib/cycleUtils` to get `[{ cycleId, cycleType }, ...]`.
- Map it to the template shape the webhook expects:
  ```ts
  const cyclesTemplate = allocated.map(c => ({ cycle_id: c.cycleId, cycle_type: c.cycleType }));
  ```
- Pass `enrollment_cycles_template: cyclesTemplate` in BOTH:
  - the Razorpay `enrollment_data` (replacing the hardcoded `[]`)
  - the cash `cash_payment_requests.enrollment_data` JSON
- Guard: if `allocated.length === 0`, surface an error and abort — never create an enrollment without cycles.

This mirrors exactly what `StudentDashboard.tsx` already does at line 284 / 323.

### 2. Insert cycles in `ConfirmCash.tsx`

In `handleConfirm`, after `supabase.from("enrollments").insert(records).select()`:

- Read `enrollmentData.enrollment_cycles_template` (the array we just added in step 1).
- For each inserted enrollment row, build `enrollment_cycles` rows using `enrollment.id`, `enrollment.student_id`, `enrollment.batch_id`, and the template's `cycle_id` + `cycle_type`. Insert them in one call.
- Same shape as the webhook does at lines 109–119.

Note: current code uses `.insert(records)` without `.select()` — switch to `.insert(records).select()` so we have ids to attach.

### 3. Backfill the 33 broken enrollments (one-shot migration)

A single SQL statement that, for every `is_active` enrollment with `start_cycle_id`/`end_cycle_id` set but zero `enrollment_cycles` rows, inserts one row per cycle in the `[start_cycle_id, end_cycle_id]` range by joining `plan_cycles`:

```sql
INSERT INTO public.enrollment_cycles (enrollment_id, student_id, batch_id, cycle_id, cycle_type)
SELECT e.id, e.student_id, e.batch_id, pc.id, pc.plan_type
FROM public.enrollments e
JOIN public.plan_cycles pc
  ON pc.organization_id = e.organization_id
 AND pc.start_date >= (SELECT start_date FROM public.plan_cycles WHERE id = e.start_cycle_id)
 AND pc.start_date <= (SELECT start_date FROM public.plan_cycles WHERE id = e.end_cycle_id)
WHERE e.is_active = true
  AND e.start_cycle_id IS NOT NULL
  AND e.end_cycle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.enrollment_cycles ec WHERE ec.enrollment_id = e.id
  );
```

Verification: after running, this should return `0`:
```sql
SELECT COUNT(*) FROM public.enrollments e
WHERE e.is_active AND e.start_cycle_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.enrollment_cycles ec WHERE ec.enrollment_id = e.id);
```

Then re-check Jaanvi Goel: should now show in Grid'26.

## Files changed

- `src/components/register/JoinBatchFlow.tsx` — compute and pass `enrollment_cycles_template` in both payment paths.
- `src/pages/ConfirmCash.tsx` — insert `enrollment_cycles` after enrollments on cash confirmation.
- One migration (data-only insert) to backfill the 33 broken rows.

No webhook change needed — it already handles a non-empty template correctly.

## Out of scope

Auditing every other code path that creates enrollments. The dashboard import / admin "add batch" flow already calls `insertEnrollmentCycles`, so this fix covers the known leak. Flag if you want a follow-up audit pass.
