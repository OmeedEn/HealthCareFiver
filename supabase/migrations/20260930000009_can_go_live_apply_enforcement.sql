-- 20260930000009_can_go_live_apply_enforcement.sql
-- SQL mirror of src/lib/auth/can-go-live.ts and stricter job-application
-- enforcement.
--
-- "Go live" = a contractor whose verification_status = 'approved' AND whose
-- profiles.subscription_status IN ('active', 'trialing'). 20260930000007 only
-- required verification to apply; applying is a go-live action, so require
-- the subscription too. The app pre-checks with canGoLive(); this is the
-- defense-in-depth layer for direct PostgREST inserts.

-- ============================================================
-- can_go_live(uuid)
-- SECURITY DEFINER so it can be used inside RLS policies (and by any caller)
-- without depending on the caller's own visibility of profiles /
-- contractor_profiles. It reveals only a boolean that is, by definition,
-- public information (live professionals are listed).
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
      AND cp.verification_status = 'approved'
      AND p.subscription_status IN ('active', 'trialing')
  );
$$;

REVOKE ALL ON FUNCTION can_go_live(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION can_go_live(UUID) TO authenticated, service_role;

-- ============================================================
-- Job applications: verified AND subscribed.
-- Same trigger name/function as 20260930000007, replaced in place.
-- HINT carries a machine-readable reason ('not_verified' | 'not_subscribed')
-- that src/app/(dashboard)/contractor/jobs/actions.ts maps to its reason
-- codes. Service role, admins and migration roles stay exempt.
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

  -- Not live: work out which half is missing. This runs as the caller, who
  -- can always read their own profiles / contractor_profiles rows. (A forged
  -- contractor_id for someone else just gets 'not_verified' here and would
  -- fail job_applications_insert_contractor's WITH CHECK anyway.)
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

  RAISE EXCEPTION 'Activate your profile to apply to jobs'
    USING ERRCODE = 'P0001', HINT = 'not_subscribed';
END;
$$;

DROP TRIGGER IF EXISTS job_applications_require_verified ON job_applications;
CREATE TRIGGER job_applications_require_verified
  BEFORE INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION enforce_verified_applicant();
