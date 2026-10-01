-- Organization onboarding (Organization Onboarding spec, steps 2-4).
--
-- Step 1 (account) is /signup/organization; steps 2-4 are the
-- /onboarding/organization wizard, which saves into these columns.
-- onboarding_step is the NEXT step to show; onboarding_submitted_at is set
-- when the org submits step 4 and lands on its dashboard.
--
-- Documents (facility license, business registration) are stored in the
-- private 'credentials' bucket under {org_id}/org/... — that bucket already
-- lets a user write/read only their own folder and admins read everything.

ALTER TABLE facility_profiles
  ADD COLUMN IF NOT EXISTS org_type TEXT,
  ADD COLUMN IF NOT EXISTS org_type_other TEXT,
  ADD COLUMN IF NOT EXISTS org_size TEXT,
  ADD COLUMN IF NOT EXISTS location_count INTEGER,
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS business_structure TEXT,
  ADD COLUMN IF NOT EXISTS registration_state TEXT,
  ADD COLUMN IF NOT EXISTS has_facility_license BOOLEAN,
  ADD COLUMN IF NOT EXISTS facility_license_type TEXT,
  ADD COLUMN IF NOT EXISTS facility_license_number TEXT,
  ADD COLUMN IF NOT EXISTS facility_license_agency TEXT,
  ADD COLUMN IF NOT EXISTS facility_license_expires DATE,
  ADD COLUMN IF NOT EXISTS org_npi TEXT,
  ADD COLUMN IF NOT EXISTS self_disclosures JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attested_authorized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authorized_checks_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intents TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS onboarding_submitted_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_org_type_check CHECK (
    org_type IS NULL OR org_type IN (
      'hospital', 'clinic', 'urgent_care', 'nursing_home', 'home_health',
      'telehealth', 'med_spa', 'gym', 'school', 'nonprofit', 'employer',
      'law_firm', 'startup', 'staffing', 'government', 'other'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_org_type_other_check
    CHECK (org_type_other IS NULL OR char_length(org_type_other) <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_org_size_check
    CHECK (org_size IS NULL OR org_size IN ('1-10', '11-50', '51-200', '201-500', '500+'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_location_count_check
    CHECK (location_count IS NULL OR location_count BETWEEN 1 AND 10000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_business_structure_check
    CHECK (business_structure IS NULL OR business_structure IN (
      'llc', 'corporation', 'nonprofit', 'government', 'sole_proprietor', 'other'
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_registration_state_check
    CHECK (registration_state IS NULL OR registration_state ~ '^[A-Z]{2}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_org_npi_check
    CHECK (org_npi IS NULL OR org_npi ~ '^[0-9]{10}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_intents_check
    CHECK (intents <@ ARRAY['advertise_services', 'host_events', 'find_professionals', 'post_needs']::TEXT[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE facility_profiles ADD CONSTRAINT facility_profiles_onboarding_step_check
    CHECK (onboarding_step BETWEEN 2 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The 300-character public description (step 2) is enforced in the app; the
-- column keeps its older, larger limit so existing profiles stay valid.

-- Orgs that existed before this flow skip the wizard.
UPDATE facility_profiles
SET onboarding_submitted_at = COALESCE(onboarding_submitted_at, created_at),
    onboarding_step = 5
WHERE onboarding_submitted_at IS NULL
  AND created_at < NOW();

-- ---------------------------------------------------------------------------
-- Verification documents (step 3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('facility_license', 'business_registration')),
  storage_path TEXT NOT NULL CHECK (char_length(storage_path) <= 1024),
  filename TEXT NOT NULL CHECK (char_length(filename) <= 255),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_documents_facility ON org_documents (facility_id, kind);

ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON org_documents FROM anon;
GRANT SELECT, INSERT, DELETE ON org_documents TO authenticated;
GRANT ALL ON org_documents TO service_role;

DROP POLICY IF EXISTS "org_documents_owner_select" ON org_documents;
CREATE POLICY "org_documents_owner_select"
  ON org_documents FOR SELECT TO authenticated
  USING (facility_id = (SELECT auth.uid()) OR (SELECT is_admin()));

-- Only into the owner's own storage folder.
DROP POLICY IF EXISTS "org_documents_owner_insert" ON org_documents;
CREATE POLICY "org_documents_owner_insert"
  ON org_documents FOR INSERT TO authenticated
  WITH CHECK (
    facility_id = (SELECT auth.uid())
    AND storage_path LIKE (SELECT auth.uid())::text || '/org/%'
  );

DROP POLICY IF EXISTS "org_documents_owner_delete" ON org_documents;
CREATE POLICY "org_documents_owner_delete"
  ON org_documents FOR DELETE TO authenticated
  USING (facility_id = (SELECT auth.uid()));
