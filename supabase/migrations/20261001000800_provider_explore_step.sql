-- Provider onboarding step 6, "Want to explore Sanus too?" (Provider
-- Onboarding spec). Professionals can use Sanus as a client too; this step
-- records what they'd like to explore so we can personalize browse mode.
-- Languages already live in contractor_profiles.languages (also shown on the
-- provider profile).

ALTER TABLE contractor_profiles
  ADD COLUMN IF NOT EXISTS explore_interests TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interest_tiles TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS explore_location TEXT;

DO $$ BEGIN
  ALTER TABLE contractor_profiles ADD CONSTRAINT contractor_profiles_explore_interests_check CHECK (
    explore_interests <@ ARRAY['book_services', 'attend_events', 'find_collaborators', 'urgent_needs', 'offering_only']::TEXT[]
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contractor_profiles ADD CONSTRAINT contractor_profiles_interest_tiles_check CHECK (
    interest_tiles <@ ARRAY['clinical_care', 'mental_health', 'nutrition', 'wellness', 'rehab', 'fitness', 'bodywork', 'consulting', 'events_education']::TEXT[]
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contractor_profiles ADD CONSTRAINT contractor_profiles_explore_location_check
    CHECK (explore_location IS NULL OR char_length(explore_location) <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The wizard now has a step 6.
ALTER TABLE contractor_profiles DROP CONSTRAINT IF EXISTS contractor_profiles_onboarding_step_check;
ALTER TABLE contractor_profiles ADD CONSTRAINT contractor_profiles_onboarding_step_check
  CHECK (onboarding_step BETWEEN 2 AND 6);
