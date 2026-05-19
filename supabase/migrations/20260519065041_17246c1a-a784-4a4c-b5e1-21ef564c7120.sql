
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS scope_restricted boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.manager_student_access (
  id bigserial PRIMARY KEY,
  organization_id bigint NOT NULL DEFAULT 1,
  manager_user_id bigint NOT NULL,
  student_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_msa_manager ON public.manager_student_access(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_msa_student ON public.manager_student_access(student_id);

ALTER TABLE public.manager_student_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated all manager_student_access"
  ON public.manager_student_access FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
