
-- Add source and photo to users table
ALTER TABLE public.users ADD COLUMN source text;
ALTER TABLE public.users ADD COLUMN photo text;

-- Drop parent_name, parent_phone, source from students table
ALTER TABLE public.students DROP COLUMN IF EXISTS parent_name;
ALTER TABLE public.students DROP COLUMN IF EXISTS parent_phone;
ALTER TABLE public.students DROP COLUMN IF EXISTS source;

-- Add dob, gender, photo to students table
ALTER TABLE public.students ADD COLUMN dob date;
ALTER TABLE public.students ADD COLUMN gender text;
ALTER TABLE public.students ADD COLUMN photo text;

-- Create photos storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Allow authenticated users to upload photos
CREATE POLICY "Allow authenticated uploads" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');

-- Allow public read access to photos
CREATE POLICY "Allow public read photos" ON storage.objects FOR SELECT USING (bucket_id = 'photos');

-- Allow authenticated users to update their photos
CREATE POLICY "Allow authenticated update photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'photos');

-- Allow authenticated users to delete photos
CREATE POLICY "Allow authenticated delete photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'photos');
