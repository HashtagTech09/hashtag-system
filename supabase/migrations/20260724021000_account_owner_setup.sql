ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS account_setup_completed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_owner_type text,
  ADD COLUMN IF NOT EXISTS account_setup_completed_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_account_owner_type_check
    CHECK (account_owner_type IS NULL OR account_owner_type IN ('self', 'parent_guardian'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE
  duplicate_phones text;
BEGIN
  SELECT string_agg(organization_id || ':' || normalized_phone || ' (' || duplicate_count || ')', ', ')
  INTO duplicate_phones
  FROM (
    SELECT
      organization_id,
      right(regexp_replace(phone, '\D', '', 'g'), 10) AS normalized_phone,
      count(*) AS duplicate_count
    FROM public.users
    WHERE phone IS NOT NULL
      AND btrim(phone) <> ''
      AND right(regexp_replace(phone, '\D', '', 'g'), 10) <> ''
    GROUP BY organization_id, right(regexp_replace(phone, '\D', '', 'g'), 10)
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_phones IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce unique user phones until duplicate phones are merged: %', duplicate_phones;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_phone_unique
  ON public.users (organization_id, right(regexp_replace(phone, '\D', '', 'g'), 10))
  WHERE phone IS NOT NULL
    AND btrim(phone) <> ''
    AND right(regexp_replace(phone, '\D', '', 'g'), 10) <> '';
