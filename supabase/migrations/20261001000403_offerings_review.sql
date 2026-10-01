-- 20261001000403_offerings_review.sql
-- Listings go through admin review before they're public, and listings that
-- need malpractice coverage (in-person, home visit, or prescribing /
-- injectables / IVs) only publish once the provider is insured.
--
-- Status lifecycle:
--   owner:  draft <-> pending_review   (pending_review only when can_go_live)
--           editing a published / rejected / paused row's content -> draft
--   admin / service role: anything, but -> 'published' only when
--           can_go_live(owner) AND (NOT requires_malpractice OR is_insured(owner))
--   public: status = 'published' AND publishable right now (a provider who
--           later loses go-live / insurance drops out of view automatically).
--
-- Existing rows keep their status ('draft' / 'published' are still valid).
--
-- Production safety: the GENERATED STORED column rewrites the table
-- (ACCESS EXCLUSIVE). professional_offerings is new (v2) and tiny; the
-- lock_timeout makes the migration fail fast rather than queue.
SET lock_timeout = '10s';

-- ============================================================
-- Columns
-- ============================================================
ALTER TABLE professional_offerings
  ADD COLUMN IF NOT EXISTS involves_medical_procedures BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_notes TEXT
    CHECK (review_notes IS NULL OR char_length(review_notes) <= 5000),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Separate statement: the generated expression references the column above.
-- COALESCE keeps it NOT NULL for rows with no format (consulting / events).
ALTER TABLE professional_offerings
  ADD COLUMN IF NOT EXISTS requires_malpractice BOOLEAN
    GENERATED ALWAYS AS (
      COALESCE(format IN ('in_person', 'home_visit'), FALSE) OR involves_medical_procedures
    ) STORED;

-- ============================================================
-- status: ('draft','published') -> + pending_review, rejected, paused.
-- The inline CHECK from 20260930000014 is professional_offerings_status_check.
-- ============================================================
ALTER TABLE professional_offerings
  DROP CONSTRAINT IF EXISTS professional_offerings_status_check;
ALTER TABLE professional_offerings
  ADD CONSTRAINT professional_offerings_status_check
  CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'paused'))
  NOT VALID;
ALTER TABLE professional_offerings
  VALIDATE CONSTRAINT professional_offerings_status_check;

-- Admin listing-review queue.
CREATE INDEX IF NOT EXISTS idx_professional_offerings_pending_review
  ON professional_offerings (created_at)
  WHERE status = 'pending_review';

-- ============================================================
-- can_publish_offering(offering id)
-- SECURITY DEFINER so it can be called for any offering (admin UI, policies)
-- regardless of the caller's visibility; returns only a boolean.
-- ============================================================
CREATE OR REPLACE FUNCTION can_publish_offering(p_offering_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT can_go_live(o.contractor_id)
      AND (NOT o.requires_malpractice OR is_insured(o.contractor_id))
    FROM professional_offerings o
    WHERE o.id = p_offering_id
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION can_publish_offering(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_publish_offering(UUID) TO anon, authenticated, service_role;

-- ============================================================
-- Status rules trigger.
-- SECURITY INVOKER: current_user is the real caller (see 20260930000008).
-- Errors:
--   42501 HINT 'review_fields_admin_only'  owner touched review_* columns
--   42501 HINT 'status_forbidden'          owner set published/rejected/paused
--   P0001 HINT 'not_verified' | 'compliance_hold' | 'agreement_required'
--         owner set pending_review while not live
--   P0001 HINT 'not_live'                  anyone published for a non-live owner
--   P0001 HINT 'malpractice_required'      anyone published a requires_malpractice
--                                          listing while the owner isn't insured
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_offering_status_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _requires BOOLEAN :=
    COALESCE(NEW.format IN ('in_person', 'home_visit'), FALSE)
    OR COALESCE(NEW.involves_medical_procedures, FALSE);
  _vstatus provider_verification_status;
  _hold TEXT;
  _agreement TIMESTAMPTZ;
  -- Columns that are not listing content.
  _meta TEXT[] := ARRAY['id', 'contractor_id', 'status', 'created_at', 'updated_at',
    'review_notes', 'reviewed_at', 'reviewed_by', 'requires_malpractice'];
BEGIN
  IF NOT is_privileged_writer() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.review_notes IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.reviewed_by IS NOT NULL THEN
        RAISE EXCEPTION 'Only Sanus can review listings'
          USING ERRCODE = '42501', HINT = 'review_fields_admin_only';
      END IF;
    ELSE
      IF NEW.review_notes IS DISTINCT FROM OLD.review_notes
        OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
        OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
      THEN
        RAISE EXCEPTION 'Only Sanus can review listings'
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
        RAISE EXCEPTION 'Listings are published by Sanus after review'
          USING ERRCODE = '42501', HINT = 'status_forbidden';
      END IF;

      IF NEW.status = 'pending_review' AND NOT can_go_live(NEW.contractor_id) THEN
        -- Runs as the owner, who can read their own row.
        SELECT cp.verification_status, cp.compliance_hold_reason, cp.contractor_agreement_accepted_at
        INTO _vstatus, _hold, _agreement
        FROM contractor_profiles cp
        WHERE cp.id = NEW.contractor_id;

        IF _vstatus IS NULL OR _vstatus NOT IN ('approved', 'insurance_pending') THEN
          RAISE EXCEPTION 'You can submit listings for review once your application is approved'
            USING ERRCODE = 'P0001', HINT = 'not_verified';
        ELSIF _hold IS NOT NULL THEN
          RAISE EXCEPTION 'Your account is on hold. Please contact Sanus support.'
            USING ERRCODE = 'P0001', HINT = 'compliance_hold';
        ELSE
          RAISE EXCEPTION 'Accept the provider agreement before submitting your first listing'
            USING ERRCODE = 'P0001', HINT = 'agreement_required';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Publishing gate: applies to every caller, admins and service role included.
  IF NEW.status = 'published'
    AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
  THEN
    IF NOT can_go_live(NEW.contractor_id) THEN
      RAISE EXCEPTION 'This professional is not live on Sanus, so the listing cannot be published'
        USING ERRCODE = 'P0001', HINT = 'not_live';
    END IF;
    IF _requires AND NOT is_insured(NEW.contractor_id) THEN
      RAISE EXCEPTION 'This listing requires reviewed malpractice coverage before it can be published'
        USING ERRCODE = 'P0001', HINT = 'malpractice_required';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professional_offerings_status_rules ON professional_offerings;
CREATE TRIGGER professional_offerings_status_rules
  BEFORE INSERT OR UPDATE ON professional_offerings
  FOR EACH ROW EXECUTE FUNCTION enforce_offering_status_rules();

-- ============================================================
-- Public read: published AND publishable now. Same predicate as
-- can_publish_offering(id), evaluated on the row itself (no re-read).
-- ============================================================
DROP POLICY IF EXISTS "professional_offerings_select_published" ON professional_offerings;
CREATE POLICY "professional_offerings_select_published"
  ON professional_offerings FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND can_go_live(contractor_id)
    AND (NOT requires_malpractice OR is_insured(contractor_id))
  );

RESET lock_timeout;
