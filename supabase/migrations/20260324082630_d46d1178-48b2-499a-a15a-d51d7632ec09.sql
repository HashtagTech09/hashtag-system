
ALTER TABLE public.plan_cycles
  ADD COLUMN grace_days integer NOT NULL DEFAULT 14,
  ADD COLUMN registration_deadline date;

-- Set grace_days based on plan_type
UPDATE public.plan_cycles SET grace_days = 14 WHERE plan_type = 'regular';
UPDATE public.plan_cycles SET grace_days = 21 WHERE plan_type = 'grid';

-- Calculate registration_deadline = start_date + grace_days
UPDATE public.plan_cycles SET registration_deadline = start_date + grace_days;
