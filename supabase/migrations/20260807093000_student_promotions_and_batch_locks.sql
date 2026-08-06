ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS promotion_required boolean NOT NULL DEFAULT false;

UPDATE public.batches
SET promotion_required = true
WHERE level IS NOT NULL
  AND lower(trim(level)) NOT IN ('', 'kids', 'level 1', 'kids level 1');

CREATE TABLE IF NOT EXISTS public.student_promotions (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL DEFAULT 1 REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id bigint NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  source_enrollment_id bigint REFERENCES public.enrollments(id) ON DELETE SET NULL,
  from_batch_id bigint REFERENCES public.batches(id) ON DELETE SET NULL,
  target_batch_id bigint REFERENCES public.batches(id) ON DELETE SET NULL,
  style_base text NOT NULL,
  from_level text,
  to_level text NOT NULL,
  recommended_by_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  manager_approved_by_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  manager_approved_at timestamptz,
  dreamcatcher_approved_by_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  dreamcatcher_approved_at timestamptz,
  rejected_by_user_id bigint REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  approved_at timestamptz,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  notes text,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_promotions_approval_status_check CHECK (
    (status = 'approved' AND approved_at IS NOT NULL)
    OR (status <> 'approved')
  )
);

CREATE INDEX IF NOT EXISTS idx_student_promotions_student_status
  ON public.student_promotions(student_id, status);

CREATE INDEX IF NOT EXISTS idx_student_promotions_target_batch
  ON public.student_promotions(target_batch_id);

CREATE INDEX IF NOT EXISTS idx_student_promotions_recommended_by
  ON public.student_promotions(recommended_by_user_id);

ALTER TABLE public.student_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read student_promotions"
  ON public.student_promotions FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow authenticated read student_promotions"
  ON public.student_promotions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert student_promotions"
  ON public.student_promotions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update student_promotions"
  ON public.student_promotions FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated delete student_promotions"
  ON public.student_promotions FOR DELETE TO authenticated
  USING (true);

GRANT SELECT ON public.student_promotions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_promotions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.student_promotions_id_seq TO authenticated;
