
CREATE TABLE public.batch_sessions (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL REFERENCES public.organizations(id),
  batch_id bigint NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  day text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, session_date, start_time)
);

ALTER TABLE public.batch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read batch_sessions" ON public.batch_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert batch_sessions" ON public.batch_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update batch_sessions" ON public.batch_sessions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete batch_sessions" ON public.batch_sessions FOR DELETE TO authenticated USING (true);
