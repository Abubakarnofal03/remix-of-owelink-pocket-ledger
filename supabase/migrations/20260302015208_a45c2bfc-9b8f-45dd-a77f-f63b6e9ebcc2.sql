
-- Create app_versions table
CREATE TABLE public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code integer NOT NULL,
  version_name text NOT NULL,
  release_notes text,
  apk_url text,
  web_bundle_url text,
  update_type text NOT NULL DEFAULT 'web',
  is_mandatory boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Everyone can read versions (needed for update checks)
CREATE POLICY "Anyone can view app versions"
  ON public.app_versions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can manage app versions"
  ON public.app_versions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for APK/web bundle files
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-updates', 'app-updates', true);

-- Allow authenticated users to read from the bucket
CREATE POLICY "Anyone can download updates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'app-updates');

-- Only admins can upload to the bucket
CREATE POLICY "Admins can upload updates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'app-updates' AND public.has_role(auth.uid(), 'admin'));
