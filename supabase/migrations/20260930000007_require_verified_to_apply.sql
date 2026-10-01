-- 20260930000007_require_verified_to_apply.sql
-- Contractors insert job_applications directly from the browser (RLS policy
-- job_applications_insert_contractor only checks contractor_id = auth.uid()),
-- so nothing stopped an unverified provider from applying. Enforce it in the
-- database: only providers whose verification_status = 'approved' may apply.
-- Service role, admins, and migration roles are exempt.

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

  IF NOT EXISTS (
    SELECT 1 FROM contractor_profiles
    WHERE id = NEW.contractor_id AND verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'You can apply once your credentials are verified'
      USING ERRCODE = 'P0001', HINT = 'not_verified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_applications_require_verified ON job_applications;
CREATE TRIGGER job_applications_require_verified
  BEFORE INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION enforce_verified_applicant();
