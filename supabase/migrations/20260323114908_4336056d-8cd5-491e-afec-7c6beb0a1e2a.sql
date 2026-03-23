
-- Plan Cycles table
CREATE TABLE public.plan_cycles (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  plan_type text NOT NULL DEFAULT 'regular',
  duration_days integer,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

ALTER TABLE public.plan_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read plan_cycles" ON public.plan_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert plan_cycles" ON public.plan_cycles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update plan_cycles" ON public.plan_cycles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete plan_cycles" ON public.plan_cycles FOR DELETE TO authenticated USING (true);

-- Subscription Plans table
CREATE TABLE public.subscription_plans (
  id bigint generated always as identity primary key,
  organization_id bigint NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,
  description text,
  total_cycles integer NOT NULL DEFAULT 0,
  total_regular_cycles integer NOT NULL DEFAULT 0,
  total_grid_cycles integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read subscription_plans" ON public.subscription_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert subscription_plans" ON public.subscription_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update subscription_plans" ON public.subscription_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete subscription_plans" ON public.subscription_plans FOR DELETE TO authenticated USING (true);

-- Subscription Plan Cycles (sequence) table
CREATE TABLE public.subscription_plan_cycles (
  id bigint generated always as identity primary key,
  subscription_plan_id bigint NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  sequence_order integer NOT NULL,
  plan_type text NOT NULL DEFAULT 'regular'
);

ALTER TABLE public.subscription_plan_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read subscription_plan_cycles" ON public.subscription_plan_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert subscription_plan_cycles" ON public.subscription_plan_cycles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update subscription_plan_cycles" ON public.subscription_plan_cycles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete subscription_plan_cycles" ON public.subscription_plan_cycles FOR DELETE TO authenticated USING (true);

-- Add subscription columns to enrollments
ALTER TABLE public.enrollments
  ADD COLUMN subscription_plan_id bigint REFERENCES public.subscription_plans(id),
  ADD COLUMN start_cycle_id bigint REFERENCES public.plan_cycles(id),
  ADD COLUMN end_cycle_id bigint REFERENCES public.plan_cycles(id);
