
CREATE TABLE public.notification_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id bigint NOT NULL DEFAULT 1,
  channel text NOT NULL,
  recipient text NOT NULL,
  template_name text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read notification_log" ON public.notification_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert notification_log" ON public.notification_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon read notification_log" ON public.notification_log FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert notification_log" ON public.notification_log FOR INSERT TO anon WITH CHECK (true);

CREATE TABLE public.whatsapp_otp (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  phone text NOT NULL,
  otp text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon insert whatsapp_otp" ON public.whatsapp_otp FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select whatsapp_otp" ON public.whatsapp_otp FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon update whatsapp_otp" ON public.whatsapp_otp FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow authenticated all whatsapp_otp" ON public.whatsapp_otp FOR ALL TO authenticated USING (true) WITH CHECK (true);
