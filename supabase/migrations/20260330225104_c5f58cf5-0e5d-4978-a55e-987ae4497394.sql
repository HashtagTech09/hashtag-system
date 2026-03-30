
-- Add style_base and eligibility_key to batches (level column already exists)
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS style_base text;
ALTER TABLE public.batches ADD COLUMN IF NOT EXISTS eligibility_key text;

-- Create payment_allocations table
CREATE TABLE public.payment_allocations (
  id bigint generated always as identity primary key,
  payment_id bigint NOT NULL,
  batch_id bigint NOT NULL,
  studio_id bigint,
  allocated_amount numeric NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read payment_allocations" ON public.payment_allocations FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert payment_allocations" ON public.payment_allocations FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow authenticated read payment_allocations" ON public.payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert payment_allocations" ON public.payment_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update payment_allocations" ON public.payment_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete payment_allocations" ON public.payment_allocations FOR DELETE TO authenticated USING (true);

-- Create drop_in_credits table
CREATE TABLE public.drop_in_credits (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL DEFAULT 1,
  student_id bigint NOT NULL,
  eligibility_key text NOT NULL,
  credits_total integer NOT NULL DEFAULT 1,
  credits_used integer NOT NULL DEFAULT 0,
  expiry_date date,
  payment_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.drop_in_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon read drop_in_credits" ON public.drop_in_credits FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert drop_in_credits" ON public.drop_in_credits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update drop_in_credits" ON public.drop_in_credits FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow authenticated read drop_in_credits" ON public.drop_in_credits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert drop_in_credits" ON public.drop_in_credits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update drop_in_credits" ON public.drop_in_credits FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete drop_in_credits" ON public.drop_in_credits FOR DELETE TO authenticated USING (true);
