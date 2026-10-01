-- 20261001000202_go_live_v3.sql
-- Go-live v3. Mirrors src/lib/auth/can-go-live.ts.
--
--   can_go_live(uuid) =
--     role = 'contractor'
--     AND verification_status IN ('approved', 'insurance_pending')
--     AND contractor_agreement_accepted_at IS NOT NULL
--     AND compliance_hold_reason IS NULL
--   suspended / rejected / pending / needs-info / held providers are NOT live.
--
--   is_insured(uuid) = an admin has reviewed malpractice coverage
--     (insured_verified_at IS NOT NULL) AND a verified, unexpired
--     malpractice_insurance credential exists.
--
-- contractor_profiles_select_visible (20260930000010) and the
-- professional_offerings public policy call can_go_live(), so they pick up the
-- new semantics without being redefined. Signatures unchanged.

-- ============================================================
-- can_go_live(uuid)
-- ============================================================
CREATE OR REPLACE FUNCTION can_go_live(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN contractor_profiles cp ON cp.id = p.id
    WHERE p.id = p_user_id
      AND p.role = 'contractor'
      AND cp.verification_status IN ('approved', 'insurance_pending')
      AND cp.contractor_agreement_accepted_at IS NOT NULL
      AND cp.compliance_hold_reason IS NULL
  );
$$;

REVOKE ALL ON FUNCTION can_go_live(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_go_live(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- is_insured(uuid)
-- SECURITY DEFINER: credentials are owner/admin/linked-facility only, but the
-- boolean is public (it drives the "Insured" badge and listing visibility).
-- A credential with no expiration_date counts as unexpired.
-- ============================================================
CREATE OR REPLACE FUNCTION is_insured(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM contractor_profiles cp
    WHERE cp.id = p_user_id
      AND cp.insured_verified_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM credentials c
        WHERE c.contractor_id = cp.id
          AND c.credential_type = 'malpractice_insurance'
          AND c.status IN ('verified', 'expiring_soon')
          AND (c.expiration_date IS NULL OR c.expiration_date >= CURRENT_DATE)
      )
  );
$$;

REVOKE ALL ON FUNCTION is_insured(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_insured(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- accept_contractor_agreement(): insurance_pending providers are approved
-- too and must be able to accept. Otherwise unchanged from 20260930000012.
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
      AND cp.verification_status IN ('approved', 'insurance_pending')
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

-- ============================================================
-- Job applications: same trigger, same HINTs ('not_verified' |
-- 'agreement_required') so src/app/(dashboard)/contractor/jobs/actions.ts
-- keeps mapping them. Suspended / compliance-held providers get
-- 'not_verified' with an on-hold message.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_verified_applicant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _status provider_verification_status;
  _hold TEXT;
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF can_go_live(NEW.contractor_id) THEN
    RETURN NEW;
  END IF;

  -- Not live: work out why. Runs as the caller, who can always read their own
  -- profiles / contractor_profiles rows. (A forged contractor_id for someone
  -- else just gets 'not_verified' and would fail
  -- job_applications_insert_contractor's WITH CHECK anyway.)
  SELECT cp.verification_status, cp.compliance_hold_reason
  INTO _status, _hold
  FROM profiles p
  JOIN contractor_profiles cp ON cp.id = p.id
  WHERE p.id = NEW.contractor_id
    AND p.role = 'contractor';

  IF _status = 'suspended' OR (_status IN ('approved', 'insurance_pending') AND _hold IS NOT NULL) THEN
    RAISE EXCEPTION 'Your account is on hold. Please contact Sanus support.'
      USING ERRCODE = 'P0001', HINT = 'not_verified';
  END IF;

  IF _status IS NULL OR _status NOT IN ('approved', 'insurance_pending') THEN
    RAISE EXCEPTION 'You can apply once your credentials are verified'
      USING ERRCODE = 'P0001', HINT = 'not_verified';
  END IF;

  RAISE EXCEPTION 'Accept the contractor agreement to start applying'
    USING ERRCODE = 'P0001', HINT = 'agreement_required';
END;
$$;
-- job_applications_require_verified (20260930000007/13) already points at
-- this function; not recreated, to avoid an exclusive lock on job_applications.
