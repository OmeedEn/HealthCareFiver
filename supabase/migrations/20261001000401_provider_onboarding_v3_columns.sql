-- 20261001000401_provider_onboarding_v3_columns.sql
-- Provider onboarding v3: "Other" professionals, licensed/allied step-3
-- fields, practice question, self-disclosures, attestations, and the
-- admin-owned compliance columns (approval clock, malpractice grace period,
-- compliance hold, exclusion re-screening, manual review checklist).
--
-- Production safety:
--   * every ADD COLUMN is nullable or has a constant DEFAULT -> catalog-only
--     (no rewrite). IF NOT EXISTS makes re-runs no-ops.
--   * the widened professional_category CHECK is added NOT VALID and then
--     validated, so the ACCESS EXCLUSIVE window is catalog-only.
--   * lock_timeout: fail fast instead of queueing behind live traffic.
SET lock_timeout = '10s';

-- ============================================================
-- Columns (self-editable: the contractor fills these in the wizard)
-- ============================================================
ALTER TABLE contractor_profiles
  -- "Other (my profession isn't listed)"
  ADD COLUMN IF NOT EXISTS other_profession TEXT
    CHECK (other_profession IS NULL OR char_length(other_profession) <= 120),
  ADD COLUMN IF NOT EXISTS credential_basis TEXT
    CHECK (credential_basis IS NULL OR credential_basis IN ('license', 'certification', 'none')),
  -- clinical: name on license; allied: name on certification
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS other_names TEXT,
  ADD COLUMN IF NOT EXISTS license_issue_date DATE,
  ADD COLUMN IF NOT EXISTS license_expiration_date DATE,
  ADD COLUMN IF NOT EXISTS has_compact_license BOOLEAN,
  ADD COLUMN IF NOT EXISTS telehealth_states TEXT[] NOT NULL DEFAULT '{}',
  -- practice question: in-person/hands-on, home visits, prescribing,
  -- injectables or IVs  =>  malpractice coverage required
  ADD COLUMN IF NOT EXISTS offers_high_risk_services BOOLEAN,
  -- {"license_action":{"answer":bool,"details":text|null},
  --  "exclusion":{...},"conviction":{...},"malpractice":{...}}
  ADD COLUMN IF NOT EXISTS self_disclosures JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(self_disclosures) = 'object'),
  ADD COLUMN IF NOT EXISTS carries_liability_insurance BOOLEAN,
  ADD COLUMN IF NOT EXISTS attested_accurate_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authorized_checks_at TIMESTAMPTZ,
  -- admin / service-role only (protected below)
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS insurance_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS insured_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_exclusion_check_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_checklist JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(admin_checklist) = 'object');

-- Searchable typed profession (admin queue / search: lower(other_profession)).
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_other_profession
  ON contractor_profiles (lower(other_profession))
  WHERE other_profession IS NOT NULL;

-- Lifecycle cron scans (grace-period deadline).
CREATE INDEX IF NOT EXISTS idx_contractor_profiles_insurance_due
  ON contractor_profiles (insurance_due_at)
  WHERE insurance_due_at IS NOT NULL;

-- ============================================================
-- professional_category: add 'other'. The inline CHECK from 20260930000002
-- got the default name contractor_profiles_professional_category_check.
-- ============================================================
ALTER TABLE contractor_profiles
  DROP CONSTRAINT IF EXISTS contractor_profiles_professional_category_check;
ALTER TABLE contractor_profiles
  ADD CONSTRAINT contractor_profiles_professional_category_check
  CHECK (professional_category IN ('clinical', 'allied', 'consultant', 'educator', 'other'))
  NOT VALID;
ALTER TABLE contractor_profiles
  VALIDATE CONSTRAINT contractor_profiles_professional_category_check;

-- ============================================================
-- Protect the admin-owned compliance columns.
-- Same caller model as 20260930000008 / 20260930000012: SECURITY INVOKER so
-- current_user is the real caller; is_privileged_writer() exempts
-- service_role, postgres, supabase_admin and is_admin() users.
-- (verification_status itself stays protected by
--  contractor_profiles_protect_verification.)
-- ============================================================
CREATE OR REPLACE FUNCTION protect_contractor_compliance_columns()
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
    IF NEW.approved_at IS NOT NULL
      OR NEW.insurance_due_at IS NOT NULL
      OR NEW.insured_verified_at IS NOT NULL
      OR NEW.compliance_hold_reason IS NOT NULL
      OR NEW.last_exclusion_check_at IS NOT NULL
      OR NEW.admin_checklist IS DISTINCT FROM '{}'::jsonb
    THEN
      RAISE EXCEPTION 'Only admins can modify provider compliance fields'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.insurance_due_at IS DISTINCT FROM OLD.insurance_due_at
    OR NEW.insured_verified_at IS DISTINCT FROM OLD.insured_verified_at
    OR NEW.compliance_hold_reason IS DISTINCT FROM OLD.compliance_hold_reason
    OR NEW.last_exclusion_check_at IS DISTINCT FROM OLD.last_exclusion_check_at
    OR NEW.admin_checklist IS DISTINCT FROM OLD.admin_checklist
  THEN
    RAISE EXCEPTION 'Only admins can modify provider compliance fields'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractor_profiles_protect_compliance ON contractor_profiles;
CREATE TRIGGER contractor_profiles_protect_compliance
  BEFORE INSERT OR UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION protect_contractor_compliance_columns();

-- ============================================================
-- credentials.coverage_amount (malpractice). Mapping for a malpractice
-- certificate: carrier -> issuing_authority, policy number -> license_number,
-- expiry -> expiration_date, coverage -> coverage_amount.
-- ============================================================
ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS coverage_amount TEXT
    CHECK (coverage_amount IS NULL OR char_length(coverage_amount) <= 200);

-- Same function as 20260930000008, plus coverage_amount in the "substance"
-- list: editing a reviewed certificate's coverage sends it back to review
-- (and therefore drops is_insured()).
CREATE OR REPLACE FUNCTION protect_credential_review_columns()
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
    IF NEW.status NOT IN ('pending_upload', 'pending_review')
      OR NEW.verified_at IS NOT NULL
      OR NEW.verified_by IS NOT NULL
      OR NEW.auto_verified
      OR NEW.verification_notes IS NOT NULL
      OR NEW.rejection_notes IS NOT NULL
      OR NEW.expiry_alert_30_sent
      OR NEW.expiry_alert_60_sent
      OR NEW.expiry_alert_90_sent
    THEN
      RAISE EXCEPTION 'New credentials must be submitted for review'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.verified_at IS DISTINCT FROM OLD.verified_at
    OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
    OR NEW.auto_verified IS DISTINCT FROM OLD.auto_verified
    OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
    OR NEW.rejection_notes IS DISTINCT FROM OLD.rejection_notes
    OR NEW.expiry_alert_30_sent IS DISTINCT FROM OLD.expiry_alert_30_sent
    OR NEW.expiry_alert_60_sent IS DISTINCT FROM OLD.expiry_alert_60_sent
    OR NEW.expiry_alert_90_sent IS DISTINCT FROM OLD.expiry_alert_90_sent
    OR (
      NEW.status IS DISTINCT FROM OLD.status
      AND NEW.status NOT IN ('pending_upload', 'pending_review')
    )
  THEN
    RAISE EXCEPTION 'Only admins can review credentials'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.status NOT IN ('pending_upload', 'pending_review') AND (
    NEW.credential_type IS DISTINCT FROM OLD.credential_type OR
    NEW.name IS DISTINCT FROM OLD.name OR
    NEW.issuing_authority IS DISTINCT FROM OLD.issuing_authority OR
    NEW.license_number IS DISTINCT FROM OLD.license_number OR
    NEW.issued_date IS DISTINCT FROM OLD.issued_date OR
    NEW.expiration_date IS DISTINCT FROM OLD.expiration_date OR
    NEW.coverage_amount IS DISTINCT FROM OLD.coverage_amount OR
    NEW.document_url IS DISTINCT FROM OLD.document_url OR
    NEW.document_filename IS DISTINCT FROM OLD.document_filename
  ) THEN
    NEW.status := 'pending_review';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.auto_verified := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

RESET lock_timeout;
