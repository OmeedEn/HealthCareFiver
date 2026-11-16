-- 20261114100100_eligibility_enforcement.sql
-- Server-side eligibility: one rule set for publishing, public visibility and
-- booking/request creation. SQL mirror of src/lib/eligibility/rules.ts; the
-- state model is documented in docs/state-model.md.
--
-- NOT YET APPLIED. Review before applying; see "Behavior changes" below.
--
-- What this does (additive; no existing migration is edited):
--   1. Nullable risk flags: professional_offerings.hands_on_care,
--      org_listings.hands_on_care / involves_medical_procedures.
--      NULL = not declared; the rules treat undeclared in-person care as
--      high-risk (fail closed).
--   2. can_go_live(uuid) additionally requires an active account and no
--      lapsed license / certification / government ID (closes the gap until
--      the daily compliance cron sets a hold). Every policy that already calls
--      can_go_live (provider visibility, offerings, rates, photos, job
--      applications) picks this up.
--   3. offering_is_high_risk(): malpractice coverage is required only for
--      hands-on / in-person care, home visits, prescribing, injectables, IVs.
--      In-person services by consultant / educator professionals and every
--      consulting / event listing are not high-risk unless flagged.
--      No grace period: a high-risk listing never publishes / shows without
--      is_insured().
--   4. Professional offerings publish only from pending_review / paused —
--      approving a provider (or an admin) can never publish a draft or a
--      rejected listing directly.
--   5. Organization listings publish only from in_review, with an approved
--      org + accepted agreement, for every caller (admins / service role
--      included). High-risk organization services can't publish, show or be
--      booked: organizations have no coverage-document model yet.
--   6. org_bookings inserts (request_org_booking) re-check the listing.
--   7. org_inquiries can only target professionals who can go live.
--
-- Behavior changes to review before applying:
--   * Published org_listings that are in-person / hybrid services without
--     both risk flags explicitly FALSE, or home visits, drop out of public
--     view and can't be booked. There is no UI to declare the flags yet
--     (decision needed: org coverage model + listing risk questions).
--   * In-person professional services by consultant / educator providers no
--     longer need malpractice coverage to publish. The generated
--     requires_malpractice column is left as-is (the compliance cron still
--     pauses on it, which stays conservative).
--   * Providers with an expired license / certification / ID, or an inactive
--     account, stop being live immediately rather than at the next cron run.
--
-- Production safety: ADD COLUMN of nullable columns is catalog-only. Trigger /
-- policy replacement takes brief locks; lock_timeout fails fast.
SET lock_timeout = '10s';

-- ============================================================
-- 1. Risk flags
-- ============================================================
ALTER TABLE professional_offerings
  ADD COLUMN IF NOT EXISTS hands_on_care BOOLEAN;

ALTER TABLE org_listings
  ADD COLUMN IF NOT EXISTS hands_on_care BOOLEAN,
  ADD COLUMN IF NOT EXISTS involves_medical_procedures BOOLEAN;

COMMENT ON COLUMN professional_offerings.hands_on_care IS
  'Listing involves hands-on care. NULL = not declared (in-person services by clinical/allied/other providers then count as high-risk).';
COMMENT ON COLUMN org_listings.hands_on_care IS
  'Listing involves hands-on care. NULL = not declared (fail closed for in-person/hybrid services).';
COMMENT ON COLUMN org_listings.involves_medical_procedures IS
  'Prescribing, injectables or IVs. NULL = not declared (fail closed for in-person/hybrid services).';

-- ============================================================
-- 2. Credentials current + can_go_live
-- ============================================================
-- Mirrors hasExpiredCredential() in src/lib/eligibility/rules.ts and
-- findHoldLapse() in src/lib/compliance/rules.ts.
CREATE OR REPLACE FUNCTION provider_credentials_current(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
      -- self-reported license expiration passed, not cured by a newer
      -- current verified license
      SELECT 1 FROM contractor_profiles cp
      WHERE cp.id = p_user_id
        AND cp.license_expiration_date IS NOT NULL
        AND cp.license_expiration_date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM credentials c
          WHERE c.contractor_id = cp.id
            AND c.credential_type = 'license'
            AND c.status IN ('verified', 'expiring_soon')
            AND c.expiration_date IS NOT NULL
            AND c.expiration_date >= CURRENT_DATE
            AND c.expiration_date > cp.license_expiration_date
        )
    )
    AND NOT EXISTS (
      -- a once-verified license / certification / ID lapsed with no current
      -- verified credential of the same type
      SELECT 1 FROM credentials c
      WHERE c.contractor_id = p_user_id
        AND c.credential_type IN ('license', 'certification', 'government_id')
        AND c.status IN ('verified', 'expiring_soon', 'expired')
        AND c.expiration_date IS NOT NULL
        AND c.expiration_date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM credentials c2
          WHERE c2.contractor_id = c.contractor_id
            AND c2.credential_type = c.credential_type
            AND c2.status IN ('verified', 'expiring_soon')
            AND (c2.expiration_date IS NULL OR c2.expiration_date >= CURRENT_DATE)
        )
    );
$$;

REVOKE ALL ON FUNCTION provider_credentials_current(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION provider_credentials_current(UUID) TO anon, authenticated, service_role;

-- Same signature as 20261001000402; adds is_active + current credentials.
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
      AND p.is_active
      AND cp.verification_status IN ('approved', 'insurance_pending')
      AND cp.contractor_agreement_accepted_at IS NOT NULL
      AND cp.compliance_hold_reason IS NULL
  ) AND provider_credentials_current(p_user_id);
$$;

REVOKE ALL ON FUNCTION can_go_live(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_go_live(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- 3. High-risk professional offerings
-- ============================================================
-- Mirrors offeringIsHighRisk() in src/lib/eligibility/rules.ts.
CREATE OR REPLACE FUNCTION offering_is_high_risk(
  p_contractor_id UUID,
  p_kind TEXT,
  p_format TEXT,
  p_medical BOOLEAN,
  p_hands_on BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_medical, FALSE) OR COALESCE(p_hands_on, FALSE) THEN TRUE
    WHEN p_kind IS DISTINCT FROM 'service' THEN FALSE
    WHEN p_format = 'home_visit' THEN TRUE
    WHEN p_format = 'in_person' THEN
      CASE
        WHEN p_hands_on IS FALSE THEN FALSE
        ELSE COALESCE((
          SELECT cp.professional_category NOT IN ('consultant', 'educator')
          FROM contractor_profiles cp WHERE cp.id = p_contractor_id
        ), TRUE)
      END
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION offering_is_high_risk(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION offering_is_high_risk(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO anon, authenticated, service_role;

-- Publicly visible / bookable right now (status aside). Row-level inputs so
-- the policy doesn't re-read the row.
CREATE OR REPLACE FUNCTION offering_is_eligible(
  p_contractor_id UUID,
  p_kind TEXT,
  p_format TEXT,
  p_medical BOOLEAN,
  p_hands_on BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT can_go_live(p_contractor_id)
    AND (NOT offering_is_high_risk(p_contractor_id, p_kind, p_format, p_medical, p_hands_on)
         OR is_insured(p_contractor_id));
$$;

REVOKE ALL ON FUNCTION offering_is_eligible(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION offering_is_eligible(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO anon, authenticated, service_role;

-- Same signature as 20261001000403.
CREATE OR REPLACE FUNCTION can_publish_offering(p_offering_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT offering_is_eligible(o.contractor_id, o.kind, o.format, o.involves_medical_procedures, o.hands_on_care)
    FROM professional_offerings o
    WHERE o.id = p_offering_id
  ), FALSE);
$$;

-- ============================================================
-- 4. professional_offerings status rules (replaces 20261001000403's body)
-- Unchanged owner rules; the publishing gate now:
--   * uses offering_is_high_risk (not the generated requires_malpractice)
--   * refuses publishing from draft / rejected for every caller
--     (HINT 'not_submitted'): only a submitted (pending_review) or paused
--     listing can be published. INSERT as published stays possible for
--     privileged writers only (seed scripts), still gated by eligibility.
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_offering_status_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _vstatus provider_verification_status;
  _hold TEXT;
  _agreement TIMESTAMPTZ;
  _meta TEXT[] := ARRAY['id', 'contractor_id', 'status', 'created_at', 'updated_at',
    'review_notes', 'reviewed_at', 'reviewed_by', 'requires_malpractice'];
BEGIN
  IF NOT is_privileged_writer() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.review_notes IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL THEN
        RAISE EXCEPTION 'Only Ocora can review listings'
          USING ERRCODE = '42501', HINT = 'review_fields_admin_only';
      END IF;
    ELSE
      IF NEW.review_notes IS DISTINCT FROM OLD.review_notes
        OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
        OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      THEN
        RAISE EXCEPTION 'Only Ocora can review listings'
          USING ERRCODE = '42501', HINT = 'review_fields_admin_only';
      END IF;

      -- Content edit on a reviewed listing sends it back to draft.
      IF NEW.status = OLD.status
        AND OLD.status IN ('published', 'rejected', 'paused')
        AND (to_jsonb(NEW) - _meta) IS DISTINCT FROM (to_jsonb(OLD) - _meta)
      THEN
        NEW.status := 'draft';
      END IF;
    END IF;

    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status NOT IN ('draft', 'pending_review') THEN
        RAISE EXCEPTION 'Listings are published by Ocora after review'
          USING ERRCODE = '42501', HINT = 'status_forbidden';
      END IF;

      IF NEW.status = 'pending_review' AND NOT can_go_live(NEW.contractor_id) THEN
        SELECT cp.verification_status, cp.compliance_hold_reason, cp.contractor_agreement_accepted_at
        INTO _vstatus, _hold, _agreement
        FROM contractor_profiles cp
        WHERE cp.id = NEW.contractor_id;

        IF _vstatus IS NULL OR _vstatus NOT IN ('approved', 'insurance_pending') THEN
          RAISE EXCEPTION 'You can submit listings for review once your application is approved'
            USING ERRCODE = 'P0001', HINT = 'not_verified';
        ELSIF _hold IS NOT NULL THEN
          RAISE EXCEPTION 'Your account is on hold. Please contact Ocora support.'
            USING ERRCODE = 'P0001', HINT = 'compliance_hold';
        ELSIF _agreement IS NULL THEN
          RAISE EXCEPTION 'Accept the provider agreement before submitting your first listing'
            USING ERRCODE = 'P0001', HINT = 'agreement_required';
        ELSE
          RAISE EXCEPTION 'A license, certification, or ID on file has expired. Upload a current one to continue.'
            USING ERRCODE = 'P0001', HINT = 'credential_expired';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Publishing gate: every caller, admins and service role included.
  IF NEW.status = 'published'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
  THEN
    IF TG_OP = 'UPDATE' AND OLD.status NOT IN ('pending_review', 'paused') THEN
      RAISE EXCEPTION 'Only a listing submitted for review can be published'
        USING ERRCODE = 'P0001', HINT = 'not_submitted';
    END IF;
    IF NOT can_go_live(NEW.contractor_id) THEN
      RAISE EXCEPTION 'This professional is not live on Ocora, so the listing cannot be published'
        USING ERRCODE = 'P0001', HINT = 'not_live';
    END IF;
    IF offering_is_high_risk(NEW.contractor_id, NEW.kind, NEW.format, NEW.involves_medical_procedures, NEW.hands_on_care)
      AND NOT is_insured(NEW.contractor_id)
    THEN
      RAISE EXCEPTION 'This listing requires a reviewed malpractice insurance document before it can be published'
        USING ERRCODE = 'P0001', HINT = 'malpractice_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- professional_offerings_status_rules already points at this function.

DROP POLICY IF EXISTS "professional_offerings_select_published" ON professional_offerings;
CREATE POLICY "professional_offerings_select_published"
  ON professional_offerings FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND offering_is_eligible(contractor_id, kind, format, involves_medical_procedures, hands_on_care)
  );

-- ============================================================
-- 5. Organization listings
-- ============================================================
-- Mirrors orgListingIsHighRisk() in src/lib/eligibility/rules.ts.
CREATE OR REPLACE FUNCTION public.org_listing_is_high_risk(
  p_kind TEXT,
  p_format TEXT,
  p_hands_on BOOLEAN,
  p_medical BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p_hands_on, FALSE) OR COALESCE(p_medical, FALSE) THEN TRUE
    WHEN p_kind IS DISTINCT FROM 'service' THEN FALSE
    WHEN p_format = 'home_visit' THEN TRUE
    WHEN p_format IN ('in_person', 'hybrid') THEN NOT (p_hands_on IS FALSE AND p_medical IS FALSE)
    ELSE FALSE
  END;
$$;
GRANT EXECUTE ON FUNCTION public.org_listing_is_high_risk(TEXT, TEXT, BOOLEAN, BOOLEAN) TO anon, authenticated, service_role;

-- Visible / bookable (status aside): org approved + agreement, and not an
-- unsupported high-risk service. anon-callable (org_can_publish isn't).
CREATE OR REPLACE FUNCTION public.org_listing_is_eligible(
  p_org_id UUID,
  p_kind TEXT,
  p_format TEXT,
  p_hands_on BOOLEAN,
  p_medical BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_can_publish(p_org_id)
    AND NOT org_listing_is_high_risk(p_kind, p_format, p_hands_on, p_medical);
$$;
REVOKE ALL ON FUNCTION public.org_listing_is_eligible(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_listing_is_eligible(UUID, TEXT, TEXT, BOOLEAN, BOOLEAN) TO anon, authenticated, service_role;

-- Owner rules from 20261001000900, plus the risk flags count as content.
CREATE OR REPLACE FUNCTION public.org_listings_owner_drafts_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF is_privileged_writer() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'New listings start as drafts.' USING ERRCODE = '42501';
    END IF;
    NEW.review_notes := NULL;
    NEW.reviewed_at := NULL;
    NEW.submitted_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'draft' AND NEW.status = 'in_review' THEN
      IF NOT org_can_publish(NEW.facility_id) THEN
        RAISE EXCEPTION 'Accept the organization agreement (after approval) before submitting listings.'
          USING ERRCODE = '42501', HINT = 'agreement_required';
      END IF;
      NEW.submitted_at := NOW();
    ELSIF OLD.status = 'in_review' AND NEW.status = 'draft' THEN
      NULL; -- withdraw
    ELSE
      RAISE EXCEPTION 'Listings are published after review by the Ocora team.' USING ERRCODE = '42501';
    END IF;
  ELSIF OLD.status <> 'draft' AND (
    NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR
    NEW.price_cents IS DISTINCT FROM OLD.price_cents OR NEW.format IS DISTINCT FROM OLD.format OR
    NEW.locations IS DISTINCT FROM OLD.locations OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR
    NEW.hands_on_care IS DISTINCT FROM OLD.hands_on_care OR
    NEW.involves_medical_procedures IS DISTINCT FROM OLD.involves_medical_procedures
  ) THEN
    NEW.status := 'draft';  -- content changed: needs another review
  END IF;

  NEW.review_notes := OLD.review_notes;
  NEW.reviewed_at := OLD.reviewed_at;
  RETURN NEW;
END;
$function$;

-- Publishing gate for every caller (the owner trigger exempts admins and the
-- service role). Name sorts after org_listings_drafts_only, so it sees the
-- final status.
CREATE OR REPLACE FUNCTION public.org_listings_publish_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'in_review' THEN
      RAISE EXCEPTION 'Only a listing submitted for review can be published.'
        USING ERRCODE = 'P0001', HINT = 'not_submitted';
    END IF;
    IF NOT org_can_publish(NEW.facility_id) THEN
      RAISE EXCEPTION 'This organization isn''t approved or hasn''t accepted the agreement.'
        USING ERRCODE = 'P0001', HINT = 'org_not_eligible';
    END IF;
    IF org_listing_is_high_risk(NEW.kind, NEW.format, NEW.hands_on_care, NEW.involves_medical_procedures) THEN
      RAISE EXCEPTION 'In-person, hands-on, home-visit and medical-procedure services from organizations can''t be published yet.'
        USING ERRCODE = 'P0001', HINT = 'org_coverage_unsupported';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_listings_publish_gate ON org_listings;
CREATE TRIGGER org_listings_publish_gate
  BEFORE INSERT OR UPDATE ON org_listings
  FOR EACH ROW EXECUTE FUNCTION public.org_listings_publish_gate();

DROP POLICY IF EXISTS "org_listings_select" ON org_listings;
CREATE POLICY "org_listings_select"
  ON org_listings FOR SELECT
  USING (
    facility_id = (SELECT auth.uid())
    OR (SELECT is_admin())
    OR (
      status = 'published'
      AND org_listing_is_eligible(facility_id, kind, format, hands_on_care, involves_medical_procedures)
    )
  );

-- ============================================================
-- 6. Booking requests re-check the listing (request_org_booking already
--    checks published + approved org; this adds agreement + risk, and covers
--    any other insert path). HINTs map in src/lib/bookings/actions.ts.
-- ============================================================
CREATE OR REPLACE FUNCTION public.org_bookings_require_eligible_listing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l public.org_listings%ROWTYPE;
BEGIN
  IF NEW.listing_id IS NULL THEN
    RAISE EXCEPTION 'This listing isn''t available.' USING ERRCODE = 'P0001', HINT = 'listing_unavailable';
  END IF;
  SELECT * INTO l FROM public.org_listings WHERE id = NEW.listing_id;
  IF l.id IS NULL OR l.status <> 'published' OR l.facility_id <> NEW.org_id OR NOT org_can_publish(l.facility_id) THEN
    RAISE EXCEPTION 'This listing isn''t available.' USING ERRCODE = 'P0001', HINT = 'listing_unavailable';
  END IF;
  IF org_listing_is_high_risk(l.kind, l.format, l.hands_on_care, l.involves_medical_procedures) THEN
    RAISE EXCEPTION 'This service can''t be booked on Ocora yet.'
      USING ERRCODE = 'P0001', HINT = 'org_coverage_unsupported';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_bookings_require_eligible_listing() FROM PUBLIC;

DROP TRIGGER IF EXISTS org_bookings_require_eligible_listing ON public.org_bookings;
CREATE TRIGGER org_bookings_require_eligible_listing
  BEFORE INSERT ON public.org_bookings
  FOR EACH ROW EXECUTE FUNCTION public.org_bookings_require_eligible_listing();

-- ============================================================
-- 7. Inquiries / invites only to live professionals.
--    SECURITY INVOKER so is_privileged_writer() sees the real caller.
-- ============================================================
CREATE OR REPLACE FUNCTION public.org_inquiries_require_live_professional()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_privileged_writer() AND NOT can_go_live(NEW.contractor_id) THEN
    RAISE EXCEPTION 'This professional isn''t available for inquiries right now.'
      USING ERRCODE = '42501', HINT = 'professional_unavailable';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_inquiries_require_live_professional ON org_inquiries;
CREATE TRIGGER org_inquiries_require_live_professional
  BEFORE INSERT ON org_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.org_inquiries_require_live_professional();

RESET lock_timeout;
