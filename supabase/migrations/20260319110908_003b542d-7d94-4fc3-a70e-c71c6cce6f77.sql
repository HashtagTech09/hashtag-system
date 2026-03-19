ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS wingperson text,
  ADD COLUMN IF NOT EXISTS dreamcatcher text;