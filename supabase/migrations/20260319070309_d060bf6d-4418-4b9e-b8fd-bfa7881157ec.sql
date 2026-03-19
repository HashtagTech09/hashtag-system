-- Rename staff_users to users
ALTER TABLE public.staff_users RENAME TO users;

-- Drop extra columns not in spec
ALTER TABLE public.users DROP COLUMN IF EXISTS studio_id;
ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;

-- Add user_id to students table
ALTER TABLE public.students ADD COLUMN user_id bigint REFERENCES public.users(id) ON DELETE SET NULL;

-- Update RLS policies on renamed table (drop old, create new)
DROP POLICY IF EXISTS "Allow delete staff" ON public.users;
DROP POLICY IF EXISTS "Allow insert staff" ON public.users;
DROP POLICY IF EXISTS "Allow read staff" ON public.users;
DROP POLICY IF EXISTS "Allow update staff" ON public.users;

CREATE POLICY "Allow delete users" ON public.users FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow read users" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update users" ON public.users FOR UPDATE TO authenticated USING (true);

-- Update foreign key on batches
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_instructor_id_fkey;
ALTER TABLE public.batches ADD CONSTRAINT batches_instructor_id_fkey FOREIGN KEY (instructor_id) REFERENCES public.users(id);