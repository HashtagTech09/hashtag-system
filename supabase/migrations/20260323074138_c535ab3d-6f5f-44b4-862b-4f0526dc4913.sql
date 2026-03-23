
-- Add schedule JSONB column
ALTER TABLE public.batches ADD COLUMN schedule jsonb;

-- Migrate existing data: convert days + start_time/end_time into schedule format
UPDATE public.batches
SET schedule = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'day', d,
      'start_time', COALESCE(start_time::text, ''),
      'end_time', COALESCE(end_time::text, '')
    )
  )
  FROM unnest(days) AS d
)
WHERE days IS NOT NULL AND array_length(days, 1) > 0;

-- Drop old columns
ALTER TABLE public.batches DROP COLUMN days;
ALTER TABLE public.batches DROP COLUMN start_time;
ALTER TABLE public.batches DROP COLUMN end_time;
