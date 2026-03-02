
-- Allow admins to upload files to app-updates bucket
CREATE POLICY "Admins can upload app updates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'app-updates'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update/overwrite files in app-updates bucket
CREATE POLICY "Admins can update app updates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'app-updates'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete files from app-updates bucket
CREATE POLICY "Admins can delete app updates"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'app-updates'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow anyone to read/download from app-updates (it's a public bucket)
CREATE POLICY "Anyone can read app updates"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-updates');
