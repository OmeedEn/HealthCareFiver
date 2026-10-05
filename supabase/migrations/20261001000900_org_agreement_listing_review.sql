-- Organization agreement + listing review (Organization Onboarding spec,
-- "After approval": "Click-through organization agreement, required before
-- their first listing or post publishes"; manual review checklist item 9,
-- "Review every listing, event, and staffing post before it goes live").
--
--   * accept_org_agreement(version): approved orgs only; stamps
--     facility_profiles.org_agreement_accepted_at / _version.
--   * org_listings: draft -> in_review (owner, only when approved AND the
--     agreement is accepted) -> published (admin) ; admin can send it back
--     to draft with review_notes ("changes requested").
--   * jobs: publishing (leaving draft) now also needs the agreement.

ALTER TABLE facility_profiles
  ADD COLUMN IF NOT EXISTS org_agreement_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS org_agreement_version TEXT;

ALTER TABLE org_listings
  ADD COLUMN IF NOT EXISTS review_notes TEXT CHECK (review_notes IS NULL OR char_length(review_notes) <= 4000),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.org_can_publish(p_org_id UUID)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM facility_profiles
    WHERE id = p_org_id
      AND verification_status = 'approved'
      AND org_agreement_accepted_at IS NOT NULL
  );
$function$;
REVOKE ALL ON FUNCTION public.org_can_publish(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_can_publish(UUID) TO authenticated, service_role;

-- The agreement columns are privileged: only the RPC (security definer) or
-- admins write them.
CREATE OR REPLACE FUNCTION public.protect_facility_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (
    NEW.is_verified IS DISTINCT FROM OLD.is_verified OR
    NEW.average_rating IS DISTINCT FROM OLD.average_rating OR
    NEW.total_reviews IS DISTINCT FROM OLD.total_reviews OR
    NEW.total_jobs_posted IS DISTINCT FROM OLD.total_jobs_posted OR
    NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
    NEW.verification_notes IS DISTINCT FROM OLD.verification_notes OR
    NEW.verification_reviewed_by IS DISTINCT FROM OLD.verification_reviewed_by OR
    NEW.verification_reviewed_at IS DISTINCT FROM OLD.verification_reviewed_at OR
    NEW.approved_at IS DISTINCT FROM OLD.approved_at OR
    NEW.approval_email_sent_at IS DISTINCT FROM OLD.approval_email_sent_at OR
    NEW.admin_checklist IS DISTINCT FROM OLD.admin_checklist OR
    NEW.org_agreement_accepted_at IS DISTINCT FROM OLD.org_agreement_accepted_at OR
    NEW.org_agreement_version IS DISTINCT FROM OLD.org_agreement_version
  ) AND NOT is_privileged_writer() THEN
    RAISE EXCEPTION 'Verification status, agreement, ratings and job counters are maintained by the system'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_org_agreement(p_version TEXT)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF NOT is_org_approved(_uid) THEN
    RAISE EXCEPTION 'Your organization must be approved before accepting the organization agreement'
      USING ERRCODE = '42501', HINT = 'not_approved';
  END IF;
  UPDATE facility_profiles
  SET org_agreement_accepted_at = NOW(), org_agreement_version = _version
  WHERE id = _uid;
END;
$function$;
REVOKE ALL ON FUNCTION public.accept_org_agreement(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_org_agreement(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- org_listings status rules for owners (admins / service role unrestricted):
--   insert: draft only
--   draft -> in_review: needs org_can_publish(); stamps submitted_at
--   in_review -> draft: withdraw
--   anything else (incl. -> published): refused
-- Editing a published or in-review listing sends it back to draft.
-- ---------------------------------------------------------------------------
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
      RAISE EXCEPTION 'Listings are published after review by the Sanus team.' USING ERRCODE = '42501';
    END IF;
  ELSIF OLD.status <> 'draft' AND (
    NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description OR
    NEW.price_cents IS DISTINCT FROM OLD.price_cents OR NEW.format IS DISTINCT FROM OLD.format OR
    NEW.locations IS DISTINCT FROM OLD.locations OR NEW.starts_at IS DISTINCT FROM OLD.starts_at
  ) THEN
    NEW.status := 'draft';  -- content changed: needs another review
  END IF;

  -- Owners can't write review fields.
  NEW.review_notes := OLD.review_notes;
  NEW.reviewed_at := OLD.reviewed_at;
  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------------------------
-- jobs: publishing also needs the organization agreement.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_org_approved_to_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'draft'
     AND (TG_OP = 'INSERT' OR OLD.status = 'draft')
     AND NOT is_privileged_writer() THEN
    IF NOT is_org_approved(NEW.facility_id) THEN
      RAISE EXCEPTION 'Your organization is under review. You can save drafts now and publish once you''re approved.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT org_can_publish(NEW.facility_id) THEN
      RAISE EXCEPTION 'Accept the organization agreement before publishing your first post.'
        USING ERRCODE = '42501', HINT = 'agreement_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
