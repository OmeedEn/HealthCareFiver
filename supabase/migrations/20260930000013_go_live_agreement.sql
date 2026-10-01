-- 20260930000013_go_live_agreement.sql
-- Business model change: the $29/mo subscription is dropped. "Go live" is now
--   contractor_profiles.verification_status = 'approved'
--   AND contractor_profiles.contractor_agreement_accepted_at IS NOT NULL
-- Payouts (Stripe Connect) are needed to get paid but are not a gate.
-- Mirrors src/lib/auth/can-go-live.ts.
--
-- The subscription columns on profiles are intentionally left in place.
-- contractor_profiles_select_visible (20260930000010) calls can_go_live(), so
-- it picks up the new semantics without being redefined.

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
      AND cp.verification_status = 'approved'
      AND cp.contractor_agreement_accepted_at IS NOT NULL
  );
$$;

-- anon now needs it too: professional_offerings' public SELECT policy
-- (20260930000014) is evaluated for anonymous visitors. It only returns a
-- boolean that is public by definition (live professionals are listed).
REVOKE ALL ON FUNCTION can_go_live(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_go_live(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- Job applications: same trigger, new reasons.
-- HINT is machine-readable ('not_verified' | 'agreement_required') and mapped
-- by src/app/(dashboard)/contractor/jobs/actions.ts.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_verified_applicant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') OR is_admin() THEN
    RETURN NEW;
  END IF;

  IF can_go_live(NEW.contractor_id) THEN
    RETURN NEW;
  END IF;

  -- Not live: work out which half is missing. Runs as the caller, who can
  -- always read their own profiles / contractor_profiles rows. (A forged
  -- contractor_id for someone else just gets 'not_verified' and would fail
  -- job_applications_insert_contractor's WITH CHECK anyway.)
  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN contractor_profiles cp ON cp.id = p.id
    WHERE p.id = NEW.contractor_id
      AND p.role = 'contractor'
      AND cp.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You can apply once your credentials are verified'
      USING ERRCODE = 'P0001', HINT = 'not_verified';
  END IF;

  RAISE EXCEPTION 'Accept the contractor agreement to start applying'
    USING ERRCODE = 'P0001', HINT = 'agreement_required';
END;
$$;

DROP TRIGGER IF EXISTS job_applications_require_verified ON job_applications;
CREATE TRIGGER job_applications_require_verified
  BEFORE INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION enforce_verified_applicant();
