-- 20260930000010_contractor_profiles_visibility.sql
-- Only "live" professionals are publicly visible.
--
-- contractor_profiles_select_public (USING TRUE) exposed every provider row —
-- including unverified / rejected providers and verification_notes — to every
-- signed-in user. Replace it with:
--   * the provider themself
--   * admins
--   * anyone, for providers who can go live (approved + active/trialing sub)
--   * a facility, for providers who applied to one of its jobs or are party to
--     one of its contracts (even if their subscription later lapsed), so the
--     applicants / contracts / payments pages keep working.
-- anon still has no SELECT policy on contractor_profiles (unchanged).
--
-- NOTE: RLS is row-level. Live providers' rows are readable in full by any
-- authenticated user, as before (incl. verification_notes, npi_number,
-- license fields). Narrowing columns would need a view; out of scope here.

-- ============================================================
-- Helper: has this provider applied to / contracted with the caller?
-- SECURITY DEFINER so the policy doesn't recurse through job_applications /
-- jobs / contracts RLS on every row; it only answers for auth.uid().
-- ============================================================
CREATE OR REPLACE FUNCTION is_contractor_linked_to_caller(p_contractor_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM job_applications ja
      JOIN jobs j ON j.id = ja.job_id
      WHERE ja.contractor_id = p_contractor_id
        AND j.facility_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM contracts c
      WHERE c.contractor_id = p_contractor_id
        AND c.facility_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION is_contractor_linked_to_caller(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_contractor_linked_to_caller(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "contractor_profiles_select_public" ON contractor_profiles;
DROP POLICY IF EXISTS "contractor_profiles_select_visible" ON contractor_profiles;

CREATE POLICY "contractor_profiles_select_visible"
  ON contractor_profiles FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT is_admin())
    OR can_go_live(id)
    OR is_contractor_linked_to_caller(id)
  );
