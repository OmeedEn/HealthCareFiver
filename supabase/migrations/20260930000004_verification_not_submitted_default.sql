-- 20260930000004_verification_not_submitted_default.sql
-- Make `not_submitted` the starting verification state and backfill
-- providers who were defaulted to `pending_review` without ever uploading a
-- credential (they were polluting the admin queue and seeing a misleading
-- "an admin is reviewing your documents" banner).
--
-- Lifecycle after this migration:
--   not_submitted --(contractor uploads a credential; POST
--     /api/contractor/verification/resubmit)--> pending_review
--   more_info_requested --(same route)--> pending_review
--   pending_review --(admin)--> approved | more_info_requested | rejected

-- ============================================================
-- Fix protect_verification_columns(): it was SECURITY DEFINER, and inside a
-- SECURITY DEFINER function `current_user` is the function OWNER (postgres),
-- never 'service_role'. So the intended service-role exemption never fired,
-- and every service-role write to these columns (admin approve/reject route,
-- contractor resubmit route) raised "Only admins can modify ...", because
-- is_admin() is false for the service-role JWT (no auth.uid()).
--
-- SECURITY INVOKER makes current_user the real caller role. The function only
-- reads NEW/OLD and calls is_admin() (itself SECURITY DEFINER), so it needs no
-- elevated privileges. `postgres` / `supabase_admin` (migrations, SQL editor)
-- are also exempt — they are superusers who could disable the trigger anyway.
-- `authenticated` / `anon` callers still must pass is_admin().
-- ============================================================
CREATE OR REPLACE FUNCTION protect_verification_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin')
    AND NOT is_admin()
    AND (
      NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
      NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by OR
      NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at OR
      NEW.verification_notes IS DISTINCT FROM OLD.verification_notes OR
      NEW.baa_sent_at IS DISTINCT FROM OLD.baa_sent_at OR
      NEW.approval_email_sent_at IS DISTINCT FROM OLD.approval_email_sent_at
    )
  THEN
    RAISE EXCEPTION 'Only admins can modify provider verification fields';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- New default
-- ============================================================
ALTER TABLE contractor_profiles
  ALTER COLUMN verification_status SET DEFAULT 'not_submitted';

-- ============================================================
-- Backfill: pending_review with zero credential rows -> not_submitted.
-- The protect trigger now exempts the migration role, but disable it
-- explicitly for the backfill anyway so this never depends on who runs it.
-- ============================================================
ALTER TABLE contractor_profiles DISABLE TRIGGER contractor_profiles_protect_verification;

UPDATE contractor_profiles cp
SET verification_status = 'not_submitted'
WHERE cp.verification_status = 'pending_review'
  AND NOT EXISTS (
    SELECT 1 FROM credentials c WHERE c.contractor_id = cp.id
  );

ALTER TABLE contractor_profiles ENABLE TRIGGER contractor_profiles_protect_verification;
