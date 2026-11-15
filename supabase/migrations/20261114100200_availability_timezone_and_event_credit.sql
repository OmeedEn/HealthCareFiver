-- 20261114100200_availability_timezone_and_event_credit.sql
-- Additive only. Not applied by the change that added it.
--
-- 1. contractor_availability.timezone: the IANA zone (e.g. America/Los_Angeles)
--    a weekly window or date block was entered in. Nullable; existing rows
--    keep NULL (= unknown, shown as "timezone not set").

ALTER TABLE contractor_availability
  ADD COLUMN IF NOT EXISTS timezone TEXT
    CHECK (timezone IS NULL OR char_length(timezone) BETWEEN 1 AND 64);

COMMENT ON COLUMN contractor_availability.timezone IS
  'IANA timezone the window/block was entered in. Weekly hours are not bookable appointments or approval.';

-- 2. org_listings: continuing-education credit claims.
--    Category "CEU/CME course" no longer implies accreditation. A listing
--    only claims credit when offers_ceu = TRUE, and then needs the credit
--    type, amount, accreditor / approved provider, and identifier before it
--    can go to review or be published. The claim is reviewed separately:
--    organization approval and listing publication never approve it.
--    ceu_claim_status: NULL (no claim) | 'unreviewed' | 'approved' | 'rejected'.
--    Only admins / the service role can set 'approved' or 'rejected'; any
--    owner edit to the claim resets it to 'unreviewed'.

ALTER TABLE org_listings
  ADD COLUMN IF NOT EXISTS ceu_credit_type TEXT
    CHECK (ceu_credit_type IS NULL OR char_length(ceu_credit_type) <= 120),
  ADD COLUMN IF NOT EXISTS ceu_credit_amount NUMERIC(6, 2)
    CHECK (ceu_credit_amount IS NULL OR ceu_credit_amount > 0),
  ADD COLUMN IF NOT EXISTS ceu_accreditor TEXT
    CHECK (ceu_accreditor IS NULL OR char_length(ceu_accreditor) <= 200),
  ADD COLUMN IF NOT EXISTS ceu_accreditor_id TEXT
    CHECK (ceu_accreditor_id IS NULL OR char_length(ceu_accreditor_id) <= 120),
  ADD COLUMN IF NOT EXISTS ceu_claim_status TEXT
    CHECK (ceu_claim_status IS NULL OR ceu_claim_status IN ('unreviewed', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS ceu_claim_reviewed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.org_listings_ceu_claim_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  privileged BOOLEAN := is_privileged_writer() OR is_admin();
  claim_changed BOOLEAN;
BEGIN
  IF NEW.offers_ceu IS NOT TRUE THEN
    -- No claim: nothing to review, nothing to show.
    NEW.ceu_claim_status := NULL;
    NEW.ceu_claim_reviewed_at := NULL;
  ELSIF NOT privileged THEN
    claim_changed := TG_OP = 'INSERT'
      OR NEW.offers_ceu IS DISTINCT FROM OLD.offers_ceu
      OR NEW.ceu_credit_type IS DISTINCT FROM OLD.ceu_credit_type
      OR NEW.ceu_credit_amount IS DISTINCT FROM OLD.ceu_credit_amount
      OR NEW.ceu_accreditor IS DISTINCT FROM OLD.ceu_accreditor
      OR NEW.ceu_accreditor_id IS DISTINCT FROM OLD.ceu_accreditor_id
      OR NEW.ceu_claim_status IS DISTINCT FROM OLD.ceu_claim_status;
    IF claim_changed THEN
      NEW.ceu_claim_status := 'unreviewed';
      NEW.ceu_claim_reviewed_at := NULL;
    END IF;
  END IF;

  -- A credit claim can't reach review or publication without its details.
  -- Checked on the status change only, so existing rows stay editable.
  IF NEW.offers_ceu IS TRUE AND NEW.status IN ('in_review', 'published')
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
     AND (NEW.ceu_credit_type IS NULL OR btrim(NEW.ceu_credit_type) = ''
          OR NEW.ceu_credit_amount IS NULL
          OR NEW.ceu_accreditor IS NULL OR btrim(NEW.ceu_accreditor) = ''
          OR NEW.ceu_accreditor_id IS NULL OR btrim(NEW.ceu_accreditor_id) = '') THEN
    RAISE EXCEPTION 'Add the credit type, amount, accreditor and identifier before submitting a listing that offers credit.'
      USING ERRCODE = '23514', HINT = 'ceu_details_required';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_listings_ceu_claim_guard ON org_listings;
CREATE TRIGGER org_listings_ceu_claim_guard
  BEFORE INSERT OR UPDATE ON org_listings
  FOR EACH ROW EXECUTE FUNCTION org_listings_ceu_claim_guard();

COMMENT ON COLUMN org_listings.ceu_claim_status IS
  'Separate Sanus review of a CE credit claim. Only ''approved'' may be shown as offering credit.';
