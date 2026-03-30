
-- Phase 1a: enrollment_cycles table
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

CREATE POLICY "Allow anon read enrollment_cycles" ON public.enrollment_cycles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert enrollment_cycles" ON public.enrollment_cycles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow read enrollment_cycles" ON public.enrollment_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert enrollment_cycles" ON public.enrollment_cycles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update enrollment_cycles" ON public.enrollment_cycles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete enrollment_cycles" ON public.enrollment_cycles FOR DELETE TO authenticated USING (true);

-- Phase 1b: cycle_adjustments table
CREATE TABLE public.cycle_adjustments (
  id bigint generated always as identity primary key,
  student_id bigint NOT NULL,
  batch_id bigint NOT NULL,
  original_cycle_id bigint NOT NULL,
  new_cycle_id bigint,
  adjustment_type text NOT NULL,
  reason text,
  approved_by bigint,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cycle_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read cycle_adjustments" ON public.cycle_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert cycle_adjustments" ON public.cycle_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update cycle_adjustments" ON public.cycle_adjustments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete cycle_adjustments" ON public.cycle_adjustments FOR DELETE TO authenticated USING (true);

-- Phase 1c: Extend plan_cycles
ALTER TABLE public.plan_cycles ADD COLUMN sequence_no integer;
ALTER TABLE public.plan_cycles ADD COLUMN open_for_sale boolean NOT NULL DEFAULT true;

-- Phase 2: Backfill enrollment_cycles from existing enrollments
INSERT INTO public.enrollment_cycles (enrollment_id, student_id, batch_id, cycle_id, cycle_type)
SELECT e.id, e.student_id, e.batch_id, pc.id, pc.plan_type
FROM public.enrollments e
JOIN public.plan_cycles pc ON pc.organization_id = e.organization_id
  AND pc.start_date >= (SELECT p1.start_date FROM public.plan_cycles p1 WHERE p1.id = e.start_cycle_id)
  AND pc.start_date <= COALESCE((SELECT p2.start_date FROM public.plan_cycles p2 WHERE p2.id = e.end_cycle_id), pc.start_date)
WHERE e.start_cycle_id IS NOT NULL AND e.end_cycle_id IS NOT NULL
ON CONFLICT DO NOTHING;
