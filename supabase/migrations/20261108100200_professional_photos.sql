-- 20261108100200_professional_photos.sql
-- Photo gallery on a professional's public profile (/pros/[id]).
--
-- Images live in the public 'professional-photos' bucket at
-- `{user_id}/{timestamp}.{ext}` (owner-write, keyed on the first path
-- segment, same pattern as 'avatars'). This table holds the ordered list
-- and captions. Public reads are limited to live professionals.

CREATE TABLE IF NOT EXISTS professional_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  -- Object path inside the bucket (used to delete the file).
  storage_path TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 500),
  url TEXT NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2000),
  caption TEXT CHECK (caption IS NULL OR char_length(caption) <= 200),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The file must sit in the owner's own folder.
  CHECK (split_part(storage_path, '/', 1) = contractor_id::text)
);

CREATE INDEX IF NOT EXISTS idx_professional_photos_contractor
  ON professional_photos (contractor_id, sort_order);

DROP TRIGGER IF EXISTS professional_photos_updated_at ON professional_photos;
CREATE TRIGGER professional_photos_updated_at
  BEFORE UPDATE ON professional_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- At most 12 photos per professional.
CREATE OR REPLACE FUNCTION professional_photos_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM professional_photos WHERE contractor_id = NEW.contractor_id) >= 12 THEN
    RAISE EXCEPTION 'photo limit reached'
      USING ERRCODE = 'P0001', HINT = 'photo_limit';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professional_photos_limit ON professional_photos;
CREATE TRIGGER professional_photos_limit
  BEFORE INSERT ON professional_photos
  FOR EACH ROW EXECUTE FUNCTION professional_photos_limit();

ALTER TABLE professional_photos ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON professional_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON professional_photos TO authenticated;
GRANT ALL ON professional_photos TO service_role;

DROP POLICY IF EXISTS "professional_photos_own" ON professional_photos;
CREATE POLICY "professional_photos_own"
  ON professional_photos FOR ALL
  TO authenticated
  USING (contractor_id = (SELECT auth.uid()))
  WITH CHECK (contractor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "professional_photos_admin" ON professional_photos;
CREATE POLICY "professional_photos_admin"
  ON professional_photos FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Public: photos of live professionals (profile page).
DROP POLICY IF EXISTS "professional_photos_public" ON professional_photos;
CREATE POLICY "professional_photos_public"
  ON professional_photos FOR SELECT
  TO anon, authenticated
  USING (can_go_live(contractor_id));

-- Storage bucket ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('professional-photos', 'professional-photos', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "professional_photos_public_read" ON storage.objects;
CREATE POLICY "professional_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'professional-photos');

DROP POLICY IF EXISTS "professional_photos_owner_insert" ON storage.objects;
CREATE POLICY "professional_photos_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'professional-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "professional_photos_owner_update" ON storage.objects;
CREATE POLICY "professional_photos_owner_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'professional-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'professional-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "professional_photos_owner_delete" ON storage.objects;
CREATE POLICY "professional_photos_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'professional-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
