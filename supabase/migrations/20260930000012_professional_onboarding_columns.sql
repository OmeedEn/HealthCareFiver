-- 20260930000012_professional_onboarding_columns.sql
-- Professional onboarding v2: credential fields per professional category,
-- wizard progress, and the contractor agreement (go-live gate).
--
-- Production safety: every ADD COLUMN is nullable or has a constant DEFAULT,
-- which on PG 11+ is a catalog-only change (no table rewrite). CHECKs on
-- brand-new columns validate against all-NULL/default values. IF NOT EXISTS
-- makes re-runs no-ops.

-- ============================================================
-- Columns
-- ============================================================
ALTER TABLE contractor_profiles
  -- clinical
  ADD COLUMN IF NOT EXISTS license_type TEXT,
  ADD COLUMN IF NOT EXISTS license_states TEXT[] NOT NULL DEFAULT '{}',
  -- allied / educator
  ADD COLUMN IF NOT EXISTS certification_type TEXT,
  ADD COLUMN IF NOT EXISTS certifying_organization TEXT,
  ADD COLUMN IF NOT EXISTS certification_number TEXT,
  -- consultant
  ADD COLUMN IF NOT EXISTS consulting_background TEXT
    CHECK (consulting_background IS NULL OR char_length(consulting_background) <= 300),
  ADD COLUMN IF NOT EXISTS client_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  -- educator
  ADD COLUMN IF NOT EXISTS primary_background TEXT,
  ADD COLUMN IF NOT EXISTS teaching_topics TEXT,
  ADD COLUMN IF NOT EXISTS ceu_accreditation TEXT
    CHECK (ceu_accreditation IS NULL OR ceu_accreditation IN ('yes', 'seeking', 'no')),
  -- profile
  ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}',
  -- wizard progress: next step to show (2..5)
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT NOT NULL DEFAULT 2
    CHECK (onboarding_step BETWEEN 2 AND 5),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  -- independent contractor + platform agreement (set only via
  -- accept_contractor_agreement(); protected below)
  ADD COLUMN IF NOT EXISTS contractor_agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contractor_agreement_version TEXT;

-- ============================================================
-- Backfill existing contractors (production has live users).
-- * Everyone who already exists has finished the old onboarding: never force
--   them back into the wizard.
-- * Seed license_states from the legacy single license_state.
-- Only rows not yet backfilled are touched, so a re-run is a no-op. The
-- updated_at trigger is disabled so this doesn't look like a profile edit
-- (the protect_* triggers exempt the migration role anyway).
-- ============================================================
ALTER TABLE contractor_profiles DISABLE TRIGGER contractor_profiles_updated_at;

UPDATE contractor_profiles
SET onboarding_completed_at = NOW(),
    onboarding_step = 5,
    license_states = CASE
      WHEN cardinality(license_states) = 0 AND NULLIF(BTRIM(license_state), '') IS NOT NULL
        THEN ARRAY[BTRIM(license_state)]
      ELSE license_states
    END
WHERE onboarding_completed_at IS NULL;

ALTER TABLE contractor_profiles ENABLE TRIGGER contractor_profiles_updated_at;

-- ============================================================
-- Keep legacy license_state = license_states[1] (older pages/queries read
-- license_state). Only fires when license_states is written.
-- ============================================================
CREATE OR REPLACE FUNCTION sync_contractor_license_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.license_states IS DISTINCT FROM OLD.license_states THEN
    IF cardinality(NEW.license_states) > 0 THEN
      NEW.license_state := NEW.license_states[1];
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.license_state := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractor_profiles_sync_license_state ON contractor_profiles;
CREATE TRIGGER contractor_profiles_sync_license_state
  BEFORE INSERT OR UPDATE OF license_states ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION sync_contractor_license_state();

-- ============================================================
-- Protect the agreement columns from direct self-update.
-- Same caller model as 20260930000008: SECURITY INVOKER so current_user is
-- the real caller; service_role / postgres / supabase_admin / admins exempt.
-- accept_contractor_agreement() is SECURITY DEFINER (owner postgres), so its
-- write is exempt. onboarding_* and the credential fields above are
-- deliberately NOT protected: the contractor edits them in the wizard.
-- (No contractor INSERT policy exists on contractor_profiles; INSERT is
-- covered anyway as defense in depth.)
-- ============================================================
CREATE OR REPLACE FUNCTION protect_contractor_agreement_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF is_privileged_writer() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.contractor_agreement_accepted_at IS NOT NULL
      OR NEW.contractor_agreement_version IS NOT NULL
    THEN
      RAISE EXCEPTION 'The contractor agreement must be accepted through the app'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.contractor_agreement_accepted_at IS DISTINCT FROM OLD.contractor_agreement_accepted_at
    OR NEW.contractor_agreement_version IS DISTINCT FROM OLD.contractor_agreement_version
  THEN
    RAISE EXCEPTION 'The contractor agreement must be accepted through the app'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractor_profiles_protect_agreement ON contractor_profiles;
CREATE TRIGGER contractor_profiles_protect_agreement
  BEFORE INSERT OR UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION protect_contractor_agreement_columns();

-- ============================================================
-- accept_contractor_agreement(p_version)
-- Only the calling contractor, and only once approved. Re-accepting (e.g. a
-- new agreement version) overwrites the timestamp and version.
-- ============================================================
CREATE OR REPLACE FUNCTION accept_contractor_agreement(p_version TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _version TEXT := NULLIF(BTRIM(COALESCE(p_version, '')), '');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _version IS NULL OR char_length(_version) > 64 THEN
    RAISE EXCEPTION 'Invalid agreement version' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN contractor_profiles cp ON cp.id = p.id
    WHERE p.id = _uid
      AND p.role = 'contractor'
      AND cp.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Your credentials must be approved before accepting the contractor agreement'
      USING ERRCODE = '42501', HINT = 'not_verified';
  END IF;

  UPDATE contractor_profiles
  SET contractor_agreement_accepted_at = NOW(),
      contractor_agreement_version = _version
  WHERE id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION accept_contractor_agreement(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_contractor_agreement(TEXT) TO authenticated;
