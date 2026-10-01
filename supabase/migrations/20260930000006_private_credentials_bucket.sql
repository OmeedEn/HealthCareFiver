-- 20260930000006_private_credentials_bucket.sql
-- The `credentials` storage bucket (license / government-ID / background-check
-- documents) was never defined in migrations, so whether it was public was
-- whatever someone clicked in the dashboard — and the upload page stored
-- getPublicUrl() links. Define it here as PRIVATE (forcing public=false if it
-- already exists) with owner/admin-only access. The app now stores the object
-- path in credentials.document_url and serves documents through
-- GET /api/credentials/[id]/document, which issues a short-lived signed URL.

INSERT INTO storage.buckets (id, name, public)
VALUES ('credentials', 'credentials', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Objects live at `{user_id}/{filename}`.
DROP POLICY IF EXISTS "credentials_owner_insert" ON storage.objects;
CREATE POLICY "credentials_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'credentials'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "credentials_owner_select" ON storage.objects;
CREATE POLICY "credentials_owner_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'credentials'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "credentials_admin_select" ON storage.objects;
CREATE POLICY "credentials_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'credentials' AND public.is_admin());
