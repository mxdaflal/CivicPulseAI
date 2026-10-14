/*
# Create storage bucket for evidence uploads

1. Storage
- Creates an 'evidence' bucket for citizen report photos and resolution evidence.
- Allows authenticated users to upload files.
- Allows public read access for evidence URLs (so they can be displayed in the UI).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('evidence', 'evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to evidence bucket
DROP POLICY IF EXISTS "evidence_upload_authenticated" ON storage.objects;
CREATE POLICY "evidence_upload_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evidence');

-- Allow public to read evidence files
DROP POLICY IF EXISTS "evidence_read_public" ON storage.objects;
CREATE POLICY "evidence_read_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'evidence');

-- Allow authenticated users to update their own uploads
DROP POLICY IF EXISTS "evidence_update_owner" ON storage.objects;
CREATE POLICY "evidence_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'evidence' AND owner = auth.uid())
WITH CHECK (bucket_id = 'evidence');
