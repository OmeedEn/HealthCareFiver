-- Organization onboarding step 5, "Quick setup" (Organization Onboarding
-- spec). Organizations set up only the sections they picked in step 4:
--   A. Advertise services   -> org_listings (kind = 'service')
--   B. Host events          -> org_listings (kind = 'event')
--   C. Find professionals   -> facility_profiles.looking_for
--   D. Urgent need / staffing post -> jobs (new spec columns below)
-- Nothing publishes until the org is approved (jobs: publish trigger from
-- 20261001000500; org_listings: owners can only write drafts).

-- ---------------------------------------------------------------------------
-- A/B. Organization services and events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'event')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'published')),
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 5000),
  -- service: who it's for (individuals / businesses / professionals)
  -- event:   audience (public / professionals / staff)
  audiences TEXT[] NOT NULL DEFAULT '{}',
  format TEXT CHECK (format IS NULL OR format IN ('in_person', 'virtual', 'home_visit', 'hybrid')),
  locations TEXT CHECK (locations IS NULL OR char_length(locations) <= 500),
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  contact_for_pricing BOOLEAN NOT NULL DEFAULT FALSE,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  reach_via TEXT CHECK (reach_via IS NULL OR reach_via IN ('book', 'inquiry')),
  event_type TEXT CHECK (event_type IS NULL OR event_type IN (
    'webinar', 'workshop', 'ceu_course', 'certification', 'conference', 'health_fair', 'support_group'
  )),
  starts_at TIMESTAMPTZ,              -- NULL = "set up later"
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  offers_ceu BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_listings_facility ON org_listings (facility_id, kind);

DROP TRIGGER IF EXISTS org_listings_updated_at ON org_listings;
CREATE TRIGGER org_listings_updated_at
  BEFORE UPDATE ON org_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Owners write drafts only; admins/service role move them to review/published.
CREATE OR REPLACE FUNCTION public.org_listings_owner_drafts_only()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'draft' AND NOT is_privileged_writer()
     AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
    RAISE EXCEPTION 'Listings are published after your organization is approved and the listing is reviewed.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_listings_drafts_only ON org_listings;
CREATE TRIGGER org_listings_drafts_only
  BEFORE INSERT OR UPDATE ON org_listings
  FOR EACH ROW EXECUTE FUNCTION org_listings_owner_drafts_only();

ALTER TABLE org_listings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON org_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_listings TO authenticated;
GRANT ALL ON org_listings TO service_role;

DROP POLICY IF EXISTS "org_listings_select" ON org_listings;
CREATE POLICY "org_listings_select"
  ON org_listings FOR SELECT
  USING (
    facility_id = (SELECT auth.uid())
    OR (SELECT is_admin())
    OR (status = 'published' AND is_org_approved(facility_id))
  );

DROP POLICY IF EXISTS "org_listings_owner_insert" ON org_listings;
CREATE POLICY "org_listings_owner_insert"
  ON org_listings FOR INSERT TO authenticated
  WITH CHECK (facility_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_listings_owner_update" ON org_listings;
CREATE POLICY "org_listings_owner_update"
  ON org_listings FOR UPDATE TO authenticated
  USING (facility_id = (SELECT auth.uid()))
  WITH CHECK (facility_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_listings_owner_delete" ON org_listings;
CREATE POLICY "org_listings_owner_delete"
  ON org_listings FOR DELETE TO authenticated
  USING (facility_id = (SELECT auth.uid()));

-- ---------------------------------------------------------------------------
-- C. "Looking for" profile (so Sanus can suggest matching professionals)
--   { types: [], specialties: [], engagement_types: [], settings: [],
--     timeline: '', license_states: [], min_years: n }
-- ---------------------------------------------------------------------------
ALTER TABLE facility_profiles
  ADD COLUMN IF NOT EXISTS looking_for JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- D. Urgent need / staffing post: spec fields on jobs
-- ---------------------------------------------------------------------------
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS post_type TEXT,
  ADD COLUMN IF NOT EXISTS professional_needs JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS schedule TEXT,
  ADD COLUMN IF NOT EXISTS engagement_type TEXT,
  ADD COLUMN IF NOT EXISTS pay_unit TEXT,
  ADD COLUMN IF NOT EXISTS is_volunteer BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS screening_questions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS application_deadline DATE,
  ADD COLUMN IF NOT EXISTS reviewer_emails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS applicant_cap INTEGER;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT jobs_post_type_check CHECK (
    post_type IS NULL OR post_type IN ('surge', 'staffing_shortage', 'ongoing_role', 'short_term_project')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT jobs_engagement_type_check CHECK (
    engagement_type IS NULL OR engagement_type IN ('employee', 'independent_contractor', 'volunteer')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT jobs_pay_unit_check CHECK (
    pay_unit IS NULL OR pay_unit IN ('hourly', 'daily', 'flat', 'salary')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT jobs_screening_questions_check CHECK (
    coalesce(array_length(screening_questions, 1), 0) <= 3
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT jobs_applicant_cap_check CHECK (
    applicant_cap IS NULL OR applicant_cap > 0
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pay is required on spec staffing posts (California pay transparency):
-- either a rate/range with a unit, or explicitly volunteer.
DO $$ BEGIN
  ALTER TABLE jobs ADD CONSTRAINT jobs_staffing_pay_check CHECK (
    post_type IS NULL OR is_volunteer OR (pay_rate_min IS NOT NULL AND pay_unit IS NOT NULL)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
