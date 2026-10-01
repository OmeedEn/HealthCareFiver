-- 20260930000008_protect_privileged_columns.sql
-- Close self-service privilege escalation / billing bypass holes.
--
-- RLS cannot restrict UPDATE by column, and a column-level REVOKE is a no-op
-- while `authenticated` holds Supabase's default table-level UPDATE grant (see
-- 20260808000001). So, as with protect_verification_columns(), BEFORE
-- triggers are the enforcement mechanism.
--
--   * profiles_update_own let any signed-in user set their own
--     role = 'admin', subscription_status = 'active' (skipping the $29/mo
--     paywall), is_active = true (undoing an admin deactivation), and the
--     Stripe linkage columns.
--   * contractor_profiles / facility_profiles *_update_own let users inflate
--     their own average_rating / total_reviews / job counters, and facilities
--     mark themselves is_verified.
--   * credentials_insert_own / credentials_update_own let a contractor insert
--     or flip a credential to status = 'verified' themselves — and verified
--     credentials are what contracted facilities are shown.
--
-- Caller check (lesson from 20260930000004): these functions are SECURITY
-- INVOKER so `current_user` is the real caller role. PostgREST runs each
-- request as the JWT role (`authenticated`, `anon` or `service_role`), so:
--   service_role                    -> exempt (Stripe webhook, admin API routes)
--   postgres / supabase_admin       -> exempt (migrations, SQL editor; superusers)
--   authenticated with is_admin()   -> exempt (admin UI uses the browser client)
--   anyone else                     -> may not change the protected columns
-- Writes made from inside a SECURITY DEFINER function owned by postgres (e.g.
-- handle_new_user(), update_reviewee_rating() below) run as postgres and are
-- therefore exempt, which is what those system-maintained columns need.

-- ============================================================
-- Shared caller check
-- ============================================================
CREATE OR REPLACE FUNCTION is_privileged_writer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT current_user IN ('service_role', 'postgres', 'supabase_admin')
    OR is_admin();
$$;

-- ============================================================
-- PROFILES: role, billing, Stripe linkage, account state
-- ============================================================
CREATE OR REPLACE FUNCTION protect_profiles_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.role IS DISTINCT FROM OLD.role OR
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status OR
    NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id OR
    NEW.subscription_price_id IS DISTINCT FROM OLD.subscription_price_id OR
    NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end OR
    NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR
    NEW.stripe_connect_id IS DISTINCT FROM OLD.stripe_connect_id OR
    NEW.stripe_connect_onboarded IS DISTINCT FROM OLD.stripe_connect_onboarded OR
    NEW.is_active IS DISTINCT FROM OLD.is_active OR
    NEW.is_verified IS DISTINCT FROM OLD.is_verified
  ) AND NOT is_privileged_writer() THEN
    RAISE EXCEPTION 'Only admins can modify role, subscription, billing or account status fields'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged ON profiles;
CREATE TRIGGER profiles_protect_privileged
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profiles_privileged_columns();

-- The admin Users page (src/app/admin/users/page.tsx) changes other users'
-- role / is_active through the browser client, but profiles never had an
-- admin UPDATE policy (only profiles_update_own), so those updates silently
-- matched 0 rows. Every other admin-managed table has an *_update_admin
-- policy; add the missing one so the trigger's admin exemption is reachable.
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- ============================================================
-- CONTRACTOR_PROFILES: system-maintained reputation counters
-- (verification_* columns are already covered by
--  contractor_profiles_protect_verification)
-- ============================================================
CREATE OR REPLACE FUNCTION protect_contractor_stats_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.average_rating IS DISTINCT FROM OLD.average_rating OR
    NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR
    NEW.total_jobs_completed IS DISTINCT FROM OLD.total_jobs_completed
  ) AND NOT is_privileged_writer() THEN
    RAISE EXCEPTION 'Ratings and job counters are maintained by the system'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contractor_profiles_protect_stats ON contractor_profiles;
CREATE TRIGGER contractor_profiles_protect_stats
  BEFORE UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION protect_contractor_stats_columns();

-- ============================================================
-- FACILITY_PROFILES: reputation counters + verified badge
-- ============================================================
CREATE OR REPLACE FUNCTION protect_facility_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
    NEW.average_rating IS DISTINCT FROM OLD.average_rating OR
    NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR
    NEW.total_jobs_posted IS DISTINCT FROM OLD.total_jobs_posted
  ) AND NOT is_privileged_writer() THEN
    RAISE EXCEPTION 'Verification status, ratings and job counters are maintained by the system'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS facility_profiles_protect_privileged ON facility_profiles;
CREATE TRIGGER facility_profiles_protect_privileged
  BEFORE UPDATE ON facility_profiles
  FOR EACH ROW EXECUTE FUNCTION protect_facility_privileged_columns();

-- ============================================================
-- CREDENTIALS: the review decision is admin-only
--
-- Contractors may create credentials as pending_upload / pending_review and
-- may resubmit (set status back to pending_review), but may not mark one
-- verified/rejected/expired or touch the reviewer fields. Editing the
-- substance of a credential that was already reviewed sends it back to
-- pending_review, so a verified badge can't be kept on edited data.
-- ============================================================
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

DROP TRIGGER IF EXISTS credentials_protect_review ON credentials;
CREATE TRIGGER credentials_protect_review
  BEFORE INSERT OR UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION protect_credential_review_columns();

-- ============================================================
-- update_reviewee_rating(): run as owner.
--
-- It is an AFTER trigger on reviews, so it fires as the *reviewer*. The
-- reviewer can never pass contractor_profiles_update_own /
-- facility_profiles_update_own for the reviewee's row, so its UPDATE
-- silently matched 0 rows and ratings never moved. Now that the rating
-- columns are additionally trigger-protected, make it SECURITY DEFINER (with
-- a pinned search_path) so the system-maintained aggregate is actually
-- written. It only aggregates from `reviews`; no caller input is trusted.
-- ============================================================
ALTER FUNCTION update_reviewee_rating() SECURITY DEFINER;
ALTER FUNCTION update_reviewee_rating() SET search_path = public;
