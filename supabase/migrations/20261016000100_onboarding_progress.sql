-- Single-Question Onboarding: per-flow progress.
--
-- One row per person per flow. `answered` and `skipped` hold question ids
-- from the flow's config (src/lib/onboarding/questions/*). The flow resumes on
-- the first question in neither list; skipped ids become "Finish your
-- profile" checklist items until they're answered from the dashboard.
-- The answers themselves live in the real profile columns, not here.

CREATE TABLE IF NOT EXISTS onboarding_progress (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow TEXT NOT NULL CHECK (flow IN ('professional', 'organization', 'client', 'unsure')),
  answered TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(answered) <= 100),
  skipped TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(skipped) <= 100),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, flow)
);

DROP TRIGGER IF EXISTS onboarding_progress_updated_at ON onboarding_progress;
CREATE TRIGGER onboarding_progress_updated_at
  BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_progress_select ON onboarding_progress;
CREATE POLICY onboarding_progress_select ON onboarding_progress
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS onboarding_progress_insert_own ON onboarding_progress;
CREATE POLICY onboarding_progress_insert_own ON onboarding_progress
  FOR INSERT WITH CHECK (user_id = auth.uid() AND submitted_at IS NULL);

-- Owners update their own lists. submitted_at is set by the flows' submit
-- actions; it can only move from NULL to a time, never back.
DROP POLICY IF EXISTS onboarding_progress_update_own ON onboarding_progress;
CREATE POLICY onboarding_progress_update_own ON onboarding_progress
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.onboarding_progress_keep_submitted()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     AND NOT is_privileged_writer() THEN
    NEW.submitted_at := OLD.submitted_at;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS onboarding_progress_keep_submitted ON onboarding_progress;
CREATE TRIGGER onboarding_progress_keep_submitted
  BEFORE UPDATE ON onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION onboarding_progress_keep_submitted();
