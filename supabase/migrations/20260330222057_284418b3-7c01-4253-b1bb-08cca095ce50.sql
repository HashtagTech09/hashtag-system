
-- Add columns to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS net_amount numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS rzp_account text;

-- Create pending_enrollments table
CREATE TABLE public.pending_enrollments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id bigint NOT NULL,
  enrollment_data jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS: allow service role (edge functions) to manage, anon/authenticated to read
CREATE POLICY "Allow anon insert pending_enrollments" ON public.pending_enrollments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon read pending_enrollments" ON public.pending_enrollments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update pending_enrollments" ON public.pending_enrollments FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow authenticated read pending_enrollments" ON public.pending_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert pending_enrollments" ON public.pending_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update pending_enrollments" ON public.pending_enrollments FOR UPDATE TO authenticated USING (true);
