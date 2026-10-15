-- Single-Question Onboarding: client flow (/signup/client).
--
-- 1. Interests move to the 11 tiles: legacy keys are rewritten
--    (consulting → advice_advocacy, education → events_education,
--    other → not_sure); bodywork and birth_family are new. The app maps
--    legacy keys too (src/lib/onboarding/client-interests.ts), so this can
--    run before or after the deploy.
-- 2. New client_profiles answers: how soon (help_timeline), how they'd like
--    to meet (meeting_formats), the "I'm 18 or older." attestation, and the
--    optional dashboard items (goals, language, budget, note). Written by
--    /api/auth/signup (service role, after auth.signUp — handle_new_user is
--    unchanged), the Google account step, and the owner from the dashboard
--    (existing client_profiles_update_own policy).
-- 3. care_requests: "Request help finding someone" from the results screen
--    when fewer than 3 professionals match; staff work them at
--    /admin/care-requests. No medical details are asked for (the note is
--    200 characters and the form says so).

-- ── 1. Interest keys ────────────────────────────────────────────────────
UPDATE public.client_profiles
   SET interests = ARRAY(
         SELECT DISTINCT CASE k
                  WHEN 'consulting' THEN 'advice_advocacy'
                  WHEN 'education' THEN 'events_education'
                  WHEN 'other' THEN 'not_sure'
                  ELSE k
                END
           FROM unnest(interests) AS k
       )
 WHERE interests && ARRAY['consulting', 'education', 'other']::text[];

-- ── 2. client_profiles answers ──────────────────────────────────────────
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS help_timeline TEXT,
  ADD COLUMN IF NOT EXISTS meeting_formats TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adult_attested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS goals TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS budget TEXT,
  ADD COLUMN IF NOT EXISTS note VARCHAR(200);

ALTER TABLE public.client_profiles
  DROP CONSTRAINT IF EXISTS client_profiles_help_timeline_check,
  ADD CONSTRAINT client_profiles_help_timeline_check
    CHECK (help_timeline IS NULL OR help_timeline IN ('asap', 'two_weeks', 'month', 'exploring')),
  DROP CONSTRAINT IF EXISTS client_profiles_meeting_formats_check,
  ADD CONSTRAINT client_profiles_meeting_formats_check
    CHECK (meeting_formats <@ ARRAY['virtual', 'in_person', 'home_visit', 'no_preference']::text[]),
  DROP CONSTRAINT IF EXISTS client_profiles_goals_check,
  ADD CONSTRAINT client_profiles_goals_check
    CHECK (goals IS NULL OR char_length(goals) <= 300),
  DROP CONSTRAINT IF EXISTS client_profiles_language_check,
  ADD CONSTRAINT client_profiles_language_check
    CHECK (language IS NULL OR char_length(language) <= 60),
  DROP CONSTRAINT IF EXISTS client_profiles_budget_check,
  ADD CONSTRAINT client_profiles_budget_check
    CHECK (budget IS NULL OR budget IN ('under_50', '50_100', '100_200', 'over_200', 'flexible'));

COMMENT ON COLUMN public.client_profiles.help_timeline IS
  'Client signup "How soon do you need help?": asap | two_weeks | month | exploring.';
COMMENT ON COLUMN public.client_profiles.meeting_formats IS
  'Client signup "How would you like to meet?": virtual | in_person | home_visit | no_preference.';
COMMENT ON COLUMN public.client_profiles.adult_attested_at IS
  'When the client checked "I''m 18 or older." at signup.';
COMMENT ON COLUMN public.client_profiles.note IS
  'Optional "Anything else we should know" (200 chars, no medical details).';

-- ── 3. care_requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Snapshot of the answers when they asked (the profile can change later).
  interests TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(interests) <= 20),
  timeline TEXT CHECK (timeline IS NULL OR timeline IN ('asap', 'two_weeks', 'month', 'exploring')),
  formats TEXT[] NOT NULL DEFAULT '{}'
    CHECK (formats <@ ARRAY['virtual', 'in_person', 'home_visit', 'no_preference']::text[]),
  zip TEXT CHECK (zip IS NULL OR zip ~ '^\d{5}$'),
  note VARCHAR(200),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'contacted', 'closed')),
  handled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open request per person: asking again while one is open is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS care_requests_one_open_per_user
  ON public.care_requests (user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS care_requests_status_created_idx
  ON public.care_requests (status, created_at);

DROP TRIGGER IF EXISTS care_requests_updated_at ON public.care_requests;
CREATE TRIGGER care_requests_updated_at
  BEFORE UPDATE ON public.care_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;

-- Owners file their own request (always open, never pre-handled) and read
-- their own; staff do everything. No owner UPDATE/DELETE.
DROP POLICY IF EXISTS care_requests_insert_own ON public.care_requests;
CREATE POLICY care_requests_insert_own ON public.care_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'open'
    AND handled_by IS NULL
    AND handled_at IS NULL
  );

DROP POLICY IF EXISTS care_requests_select_own ON public.care_requests;
CREATE POLICY care_requests_select_own ON public.care_requests
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS care_requests_all_admin ON public.care_requests;
CREATE POLICY care_requests_all_admin ON public.care_requests
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

REVOKE ALL ON public.care_requests FROM anon;
