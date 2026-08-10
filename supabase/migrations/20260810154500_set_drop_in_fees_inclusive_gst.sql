INSERT INTO public.system_settings (organization_id, key, value)
VALUES
  (1, 'drop_in_fee', '760'),
  (1, 'drop_in_long_fee', '1540')
ON CONFLICT (organization_id, key)
DO UPDATE SET value = EXCLUDED.value;
