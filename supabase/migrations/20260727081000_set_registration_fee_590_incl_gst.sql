INSERT INTO public.system_settings (organization_id, key, value)
VALUES (1, 'registration_fee', '500')
ON CONFLICT (organization_id, key)
DO UPDATE SET value = EXCLUDED.value;
