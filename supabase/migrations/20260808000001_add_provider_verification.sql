-- 20260808000001_add_provider_verification.sql
-- Admin provider verification queue: aggregate approval status on
-- contractor_profiles, per-vendor check results, and the RLS/grant
-- changes needed to keep the approval decision admin-only.

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE provider_verification_status AS ENUM (
  'pending_review',
  'more_info_requested',
  'approved',
  'rejected'
);

CREATE TYPE verification_check_type AS ENUM (
  'medallion',
  'checkr',
  'stripe_identity'
);

CREATE TYPE verification_check_status AS ENUM (
  'not_started',
  'pending',
  'passed',
  'failed',
  'needs_review'
);

-- New notification types for the verification workflow
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_approved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_more_info_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_rejected';

-- ============================================================
-- CONTRACTOR_PROFILES: aggregate verification state
-- ============================================================
ALTER TABLE contractor_profiles
  ADD COLUMN verification_status provider_verification_status NOT NULL DEFAULT 'pending_review',
  ADD COLUMN verification_notes TEXT,
  ADD COLUMN verification_reviewed_by UUID REFERENCES profiles(id),
  ADD COLUMN verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN baa_sent_at TIMESTAMPTZ,
  ADD COLUMN approval_email_sent_at TIMESTAMPTZ;

CREATE INDEX idx_contractor_profiles_verification_status
  ON contractor_profiles(verification_status);

-- ============================================================
-- PROVIDER_VERIFICATION_CHECKS: per-vendor result cache
-- ============================================================
CREATE TABLE provider_verification_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  check_type verification_check_type NOT NULL,
  status verification_check_status NOT NULL DEFAULT 'not_started',
  external_id TEXT,
  result_summary JSONB,
  raw_response JSONB,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contractor_id, check_type)
);

CREATE INDEX idx_provider_verification_checks_contractor
  ON provider_verification_checks(contractor_id);

CREATE TRIGGER provider_verification_checks_updated_at
  BEFORE UPDATE ON provider_verification_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE provider_verification_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_verification_checks_select_own"
  ON provider_verification_checks FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "provider_verification_checks_select_admin"
  ON provider_verification_checks FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "provider_verification_checks_insert_admin"
  ON provider_verification_checks FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "provider_verification_checks_update_admin"
  ON provider_verification_checks FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- SECURITY: the verification decision is admin-only.
--
-- contractor_profiles_update_own (20250523000011_create_rls_policies.sql)
-- lets a contractor UPDATE any column on their own row, including the
-- ones added above. Row-level policies can't restrict by column, so
-- revoke UPDATE on these specific columns from `authenticated` — all
-- writes to them go through the service-role admin API routes instead,
-- which bypass table/column grants entirely.
-- ============================================================
REVOKE UPDATE (
  verification_status,
  verification_reviewed_by,
  verification_reviewed_at,
  verification_notes,
  baa_sent_at,
  approval_email_sent_at
) ON contractor_profiles FROM authenticated;
