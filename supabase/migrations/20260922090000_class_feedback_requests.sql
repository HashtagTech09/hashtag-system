CREATE TABLE IF NOT EXISTS public.class_feedback_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE DEFAULT 1,
  batch_id BIGINT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  batch_session_id BIGINT REFERENCES public.batch_sessions(id) ON DELETE SET NULL,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('created', 'sent', 'submitted', 'expired', 'no_recipient', 'failed')),
  contact_channel TEXT CHECK (contact_channel IN ('whatsapp', 'email')),
  recipient TEXT,
  feedback_url TEXT,
  notification_status TEXT,
  notification_error TEXT,
  sent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (token),
  UNIQUE (organization_id, batch_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS public.class_feedback_responses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES public.class_feedback_requests(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  energy_rating INTEGER CHECK (energy_rating BETWEEN 1 AND 5),
  clarity_rating INTEGER CHECK (clarity_rating BETWEEN 1 AND 5),
  liked TEXT,
  improve TEXT,
  wants_follow_up BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id)
);

ALTER TABLE public.class_feedback_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_feedback_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow scoped read class feedback requests" ON public.class_feedback_requests;
  CREATE POLICY "Allow scoped read class feedback requests"
    ON public.class_feedback_requests FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.user_roles ur ON ur.user_id = u.id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE u.auth_id = auth.uid()
          AND u.organization_id = class_feedback_requests.organization_id
          AND (
            r.name = 'admin'
            OR (r.name = 'manager' AND COALESCE(u.scope_restricted, false) = false)
            OR (
              r.name IN ('manager', 'instructor')
              AND EXISTS (
                SELECT 1
                FROM public.batches b
                WHERE b.id = class_feedback_requests.batch_id
                  AND (
                    b.instructor_id = u.id
                    OR b.instructor_2_id = u.id
                    OR (
                      r.name = 'manager'
                      AND EXISTS (
                        SELECT 1
                        FROM public.studios s
                        WHERE s.id = b.studio_id
                          AND (s.dreamcatcher_id = u.id OR s.wingperson_id = u.id)
                      )
                    )
                  )
              )
            )
            OR (
              r.name = 'manager'
              AND EXISTS (
                SELECT 1
                FROM public.manager_student_access msa
                WHERE msa.manager_user_id = u.id
                  AND msa.student_id = class_feedback_requests.student_id
              )
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Allow scoped read class feedback responses" ON public.class_feedback_responses;
  CREATE POLICY "Allow scoped read class feedback responses"
    ON public.class_feedback_responses FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.class_feedback_requests req
        WHERE req.id = class_feedback_responses.request_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_feedback_requests_created ON public.class_feedback_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_feedback_requests_student ON public.class_feedback_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_class_feedback_requests_batch_date ON public.class_feedback_requests(batch_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_feedback_responses_request ON public.class_feedback_responses(request_id);
