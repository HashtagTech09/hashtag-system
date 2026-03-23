
-- Backfill: create placeholder users for students with no user_id
INSERT INTO public.users (name, phone, organization_id, source)
SELECT s.name, s.phone, s.organization_id, 'backfill'
FROM public.students s
WHERE s.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.phone = s.phone AND u.organization_id = s.organization_id
  );

-- Link students to matching users by phone
UPDATE public.students s
SET user_id = u.id
FROM public.users u
WHERE s.user_id IS NULL
  AND u.phone = s.phone
  AND u.organization_id = s.organization_id;

-- Now enforce NOT NULL
ALTER TABLE public.students ALTER COLUMN user_id SET NOT NULL;
