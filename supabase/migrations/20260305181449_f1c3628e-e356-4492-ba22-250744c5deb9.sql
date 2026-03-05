-- Create token-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('token-logos', 'token-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to token-logos
CREATE POLICY "Authenticated users can upload token logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'token-logos');

-- Allow public read access
CREATE POLICY "Public can read token logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'token-logos');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own token logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'token-logos')
WITH CHECK (bucket_id = 'token-logos');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own token logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'token-logos');