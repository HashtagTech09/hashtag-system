
-- Organizations table
CREATE TABLE public.organizations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read organizations" ON public.organizations FOR SELECT TO authenticated USING (true);

-- Insert default org
INSERT INTO public.organizations (name) VALUES ('Hashtag Dance Company');

-- Studios table
CREATE TABLE public.studios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read studios" ON public.studios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert studios" ON public.studios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update studios" ON public.studios FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete studios" ON public.studios FOR DELETE TO authenticated USING (true);

-- Staff users table
CREATE TABLE public.staff_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  studio_id BIGINT REFERENCES public.studios(id) ON DELETE SET NULL,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'frontdesk', 'instructor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read staff" ON public.staff_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert staff" ON public.staff_users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update staff" ON public.staff_users FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete staff" ON public.staff_users FOR DELETE TO authenticated USING (true);

-- Students table
CREATE TABLE public.students (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  parent_name TEXT,
  parent_phone TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, phone)
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert students" ON public.students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update students" ON public.students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete students" ON public.students FOR DELETE TO authenticated USING (true);

-- Batches table
CREATE TABLE public.batches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  studio_id BIGINT REFERENCES public.studios(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  style TEXT,
  level TEXT,
  days TEXT[],
  start_time TIME,
  end_time TIME,
  instructor_id BIGINT REFERENCES public.staff_users(id) ON DELETE SET NULL,
  capacity INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read batches" ON public.batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert batches" ON public.batches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update batches" ON public.batches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete batches" ON public.batches FOR DELETE TO authenticated USING (true);

-- Pricing plans
CREATE TABLE public.pricing_plans (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  batch_count INT NOT NULL,
  price NUMERIC NOT NULL
);
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read pricing" ON public.pricing_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert pricing" ON public.pricing_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update pricing" ON public.pricing_plans FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete pricing" ON public.pricing_plans FOR DELETE TO authenticated USING (true);

INSERT INTO public.pricing_plans (organization_id, batch_count, price) VALUES
(1, 1, 3000), (1, 2, 5000), (1, 3, 6500), (1, 4, 7500);

-- Payments table
CREATE TABLE public.payments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'upi', 'online')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  gateway_order_id TEXT,
  gateway_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read payments" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update payments" ON public.payments FOR UPDATE TO authenticated USING (true);

-- Enrollments table
CREATE TABLE public.enrollments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
  status_type TEXT NOT NULL CHECK (status_type IN ('NEW', 'REN', 'REV')),
  late_renewal BOOLEAN DEFAULT false,
  registration_fee_applied BOOLEAN DEFAULT false,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read enrollments" ON public.enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert enrollments" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update enrollments" ON public.enrollments FOR UPDATE TO authenticated USING (true);

-- Drop-ins table
CREATE TABLE public.drop_ins (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  adjustable_until TIMESTAMPTZ,
  adjusted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drop_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read dropins" ON public.drop_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert dropins" ON public.drop_ins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update dropins" ON public.drop_ins FOR UPDATE TO authenticated USING (true);

-- Attendance table
CREATE TABLE public.attendance (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  student_id BIGINT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  batch_id BIGINT NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, batch_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert attendance" ON public.attendance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update attendance" ON public.attendance FOR UPDATE TO authenticated USING (true);

-- System settings table
CREATE TABLE public.system_settings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  UNIQUE (organization_id, key)
);
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert settings" ON public.system_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update settings" ON public.system_settings FOR UPDATE TO authenticated USING (true);

INSERT INTO public.system_settings (organization_id, key, value) VALUES
(1, 'registration_fee', '500'),
(1, 'drop_in_fee', '500'),
(1, 'renewal_grace_days', '14');
