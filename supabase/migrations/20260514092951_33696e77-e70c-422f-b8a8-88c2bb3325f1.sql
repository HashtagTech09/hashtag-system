-- 1. Backfill auth_id for existing staff rows by matching email to auth.users
UPDATE public.users u
SET auth_id = au.id
FROM auth.users au
WHERE u.auth_id IS NULL
  AND u.email IS NOT NULL
  AND lower(u.email) = lower(au.email);

-- 2. Trigger function: auto-link new auth accounts to existing staff rows by email
CREATE OR REPLACE FUNCTION public.link_auth_to_staff_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET auth_id = NEW.id
  WHERE auth_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

-- 3. Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_link_staff ON auth.users;
CREATE TRIGGER on_auth_user_created_link_staff
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.link_auth_to_staff_user();