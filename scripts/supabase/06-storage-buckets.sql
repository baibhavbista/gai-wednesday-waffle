-- Storage Buckets Setup for Wednesday Waffle

-- Create 'waffles' bucket (private - for waffle content)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'waffles',
  'waffles',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
);

-- Create 'avatars' bucket (public - for profile avatars)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true, -- Public bucket
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS Policies for 'waffles' bucket (private)
CREATE POLICY "Users can view own files in waffles bucket" ON storage.objects
FOR SELECT USING (
  bucket_id = 'waffles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload files to own folder in waffles bucket" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'waffles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own files in waffles bucket" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'waffles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own files in waffles bucket" ON storage.objects
FOR DELETE USING (
  bucket_id = 'waffles' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Additional policy: Group members can view waffles from their groups
CREATE POLICY "Group members can view group waffles" ON storage.objects
FOR SELECT USING (
  bucket_id = 'waffles' AND
  EXISTS (
    SELECT 1 FROM public.waffles w
    JOIN public.group_members gm ON w.group_id = gm.group_id
    WHERE w.content_url LIKE '%' || name AND gm.user_id = auth.uid()
  )
);

-- RLS Policies for 'avatars' bucket (public)
CREATE POLICY "Anyone can view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
); 