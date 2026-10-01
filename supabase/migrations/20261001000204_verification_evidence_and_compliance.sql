-- 20261001000204_verification_evidence_and_compliance.sql
-- Admin manual verification checklist evidence, compliance reminder log, and
-- the duplicate-account red-flag lookup. All new objects; no existing table
-- is touched.

-- ============================================================
-- verification_evidence: screenshot/PDF of each lookup (OIG, SAM.gov,
-- Medi-Cal S&I, license board, NPI, ...). Admin-only.
-- check_key matches a key in contractor_profiles.admin_checklist.
-- storage_path is an object path in the private 'verification-evidence'
-- bucket (recommended: '{contractor_id}/{check_key}/{filename}').
-- ============================================================
CREATE TABLE IF NOT EXISTS verification_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL CHECK (char_length(check_key) BETWEEN 1 AND 100),
  storage_path TEXT CHECK (storage_path IS NULL OR char_length(storage_path) <= 1024),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 5000),
  created_by UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_evidence_contractor
  ON verification_evidence (contractor_id, check_key);

ALTER TABLE verification_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON verification_evidence FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON verification_evidence TO authenticated;
GRANT ALL ON verification_evidence TO service_role;

DROP POLICY IF EXISTS "verification_evidence_all_admin" ON verification_evidence;
CREATE POLICY "verification_evidence_all_admin"
  ON verification_evidence FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- ============================================================
-- Private storage bucket, admin read/write only (service role bypasses RLS).
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-evidence', 'verification-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "verification_evidence_admin_select" ON storage.objects;
CREATE POLICY "verification_evidence_admin_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'verification-evidence' AND public.is_admin());

DROP POLICY IF EXISTS "verification_evidence_admin_insert" ON storage.objects;
CREATE POLICY "verification_evidence_admin_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'verification-evidence' AND public.is_admin());

DROP POLICY IF EXISTS "verification_evidence_admin_update" ON storage.objects;
CREATE POLICY "verification_evidence_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'verification-evidence' AND public.is_admin())
  WITH CHECK (bucket_id = 'verification-evidence' AND public.is_admin());

DROP POLICY IF EXISTS "verification_evidence_admin_delete" ON storage.objects;
CREATE POLICY "verification_evidence_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'verification-evidence' AND public.is_admin());

-- ============================================================
-- compliance_reminders: idempotency log for the lifecycle cron (grace-period
-- reminders at 14/7/1 days, expiry reminders at 60/30 days). Service-role
-- only: RLS on, no policies, no grants to anon/authenticated.
--   ref = credential id (as text) for expiry reminders, 'insurance' for the
--   malpractice grace period.
-- Insert with ON CONFLICT DO NOTHING; a returned row means "send now".
-- ============================================================
CREATE TABLE IF NOT EXISTS compliance_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 64),
  threshold_days INTEGER NOT NULL,
  ref TEXT NOT NULL DEFAULT 'insurance',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT compliance_reminders_unique UNIQUE (contractor_id, kind, threshold_days, ref)
);

ALTER TABLE compliance_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON compliance_reminders FROM anon, authenticated;
GRANT ALL ON compliance_reminders TO service_role;

-- ============================================================
-- provider_duplicate_flags(contractor) -> (kind, other_contractor)
-- Red flag: same phone or same Stripe Connect payout account on more than
-- one contractor account. kind IN ('phone', 'stripe_connect_id').
-- Phones are compared on their last 10 digits (formatting-insensitive).
-- SECURITY DEFINER (reads every profile), so it checks the caller itself:
-- admins (is_admin()) and service-role requests only; anyone else -> 42501.
-- ============================================================
CREATE OR REPLACE FUNCTION provider_duplicate_flags(p_contractor_id UUID)
RETURNS TABLE (kind TEXT, other_contractor UUID)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _phone TEXT;
  _connect TEXT;
BEGIN
  IF NOT (is_admin() OR COALESCE(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'Only admins can run duplicate-account checks'
      USING ERRCODE = '42501';
  END IF;

  SELECT RIGHT(NULLIF(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), ''), 10),
         NULLIF(BTRIM(p.stripe_connect_id), '')
  INTO _phone, _connect
  FROM profiles p
  WHERE p.id = p_contractor_id;

  IF _phone IS NOT NULL AND char_length(_phone) >= 7 THEN
    RETURN QUERY
      SELECT 'phone'::TEXT, p.id
      FROM profiles p
      WHERE p.id <> p_contractor_id
        AND p.role = 'contractor'
        AND p.phone IS NOT NULL
        AND RIGHT(regexp_replace(p.phone, '\D', '', 'g'), 10) = _phone
      ORDER BY p.id;
  END IF;

  IF _connect IS NOT NULL THEN
    RETURN QUERY
      SELECT 'stripe_connect_id'::TEXT, p.id
      FROM profiles p
      WHERE p.id <> p_contractor_id
        AND p.stripe_connect_id = _connect
      ORDER BY p.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION provider_duplicate_flags(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION provider_duplicate_flags(UUID) TO authenticated, service_role;
