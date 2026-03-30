
-- Add anon SELECT policies for public browsing
CREATE POLICY "Allow anon read batches" ON public.batches FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read batch_sessions" ON public.batch_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read studios" ON public.studios FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read plan_cycles" ON public.plan_cycles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read subscription_plans" ON public.subscription_plans FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read subscription_plan_cycles" ON public.subscription_plan_cycles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read pricing_plans" ON public.pricing_plans FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read system_settings" ON public.system_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read students" ON public.students FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read users" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read enrollments" ON public.enrollments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon read drop_ins" ON public.drop_ins FOR SELECT TO anon USING (true);

-- Add anon INSERT policies for self-registration
CREATE POLICY "Allow anon insert users" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert students" ON public.students FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert payments" ON public.payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert enrollments" ON public.enrollments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon insert drop_ins" ON public.drop_ins FOR INSERT TO anon WITH CHECK (true);

-- Allow anon to update drop_ins (for adjustment marking)
CREATE POLICY "Allow anon update drop_ins" ON public.drop_ins FOR UPDATE TO anon USING (true);
