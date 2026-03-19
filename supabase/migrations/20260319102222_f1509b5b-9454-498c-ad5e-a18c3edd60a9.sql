-- 1. Create roles table
CREATE TABLE public.roles (
  id bigint generated always as identity primary key,
  name text NOT NULL UNIQUE,
  type text NOT NULL
);
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read roles" ON public.roles FOR SELECT TO authenticated USING (true);

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
  id bigint generated always as identity primary key,
  user_id bigint NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  organization_id bigint NOT NULL REFERENCES public.organizations(id),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, organization_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read user_roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert user_roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow update user_roles" ON public.user_roles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow delete user_roles" ON public.user_roles FOR DELETE TO authenticated USING (true);

-- 3. Seed roles
INSERT INTO public.roles (name, type) VALUES
  ('admin', 'organization'),
  ('manager', 'organization'),
  ('instructor', 'organization'),
  ('frontdesk', 'organization'),
  ('parent', 'student_side'),
  ('member', 'student_side');

-- 4. Migrate existing role data
INSERT INTO public.user_roles (user_id, role_id, organization_id, is_primary)
SELECT u.id, r.id, u.organization_id, true
FROM public.users u JOIN public.roles r ON r.name = u.role;

-- 5. Drop role column from users
ALTER TABLE public.users DROP COLUMN role;