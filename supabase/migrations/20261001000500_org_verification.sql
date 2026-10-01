-- Organization verification (Organization Onboarding spec: "Manual
-- verification: every organization is reviewed before anything goes public").
--
-- Organizations are facility_profiles rows (role facility / staffing_agency).
-- Until now the only review state was is_verified, which gated nothing: an
-- unreviewed org could publish jobs, message professionals and move
-- applicants. This adds the spec's five statuses and enforces them in RLS and
-- triggers so the browser can't bypass them:
--
--   * jobs: drafts are always allowed; leaving draft (publishing) requires an
--     approved org, and other users only see open jobs from approved orgs.
--   * conversations / messages: an org that isn't approved can't start a
--     conversation or send a message.
--   * job_applications: an org that isn't approved can't change applicant
--     status.
--   * facility_profiles: other users see approved orgs, plus orgs they
--     already share a conversation or contract with.
--
-- is_verified is kept in sync (approved <=> true) for older code paths.

DO $$ BEGIN
  CREATE TYPE org_verification_status AS ENUM (
    'pending_review', 'needs_info', 'approved', 'suspended', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE facility_profiles
  ADD COLUMN IF NOT EXISTS verification_status org_verification_status NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS verification_notes TEXT,
  -- No FK: a second facility_profiles→profiles FK makes PostgREST embeds
  -- between the two ambiguous (PGRST201).
  ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_facility_profiles_verification_status
  ON facility_profiles (verification_status);

-- Orgs an admin already marked verified are approved; everyone else waits
-- for review.
UPDATE facility_profiles
SET verification_status = 'approved',
    approved_at = COALESCE(approved_at, updated_at, NOW())
WHERE is_verified = TRUE AND verification_status = 'pending_review';

-- ---------------------------------------------------------------------------
-- Privileged columns: only admins / service role can change review state.
-- (Trigger names sort so protect_privileged runs before sync_verified.)
-- ---------------------------------------------------------------------------
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
    NEW.admin_checklist IS DISTINCT FROM OLD.admin_checklist
  ) AND NOT is_privileged_writer() THEN
    RAISE EXCEPTION 'Verification status, ratings and job counters are maintained by the system'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- A new org can't sign itself up as approved.
CREATE OR REPLACE FUNCTION public.facility_profiles_force_pending_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_privileged_writer() THEN
    NEW.verification_status := 'pending_review';
    NEW.verification_notes := NULL;
    NEW.verification_reviewed_by := NULL;
    NEW.verification_reviewed_at := NULL;
    NEW.approved_at := NULL;
    NEW.approval_email_sent_at := NULL;
    NEW.admin_checklist := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS facility_profiles_force_pending ON facility_profiles;
CREATE TRIGGER facility_profiles_force_pending
  BEFORE INSERT ON facility_profiles
  FOR EACH ROW EXECUTE FUNCTION facility_profiles_force_pending_on_insert();

CREATE OR REPLACE FUNCTION public.facility_profiles_sync_verified()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.is_verified := (NEW.verification_status = 'approved');
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS facility_profiles_sync_verified ON facility_profiles;
CREATE TRIGGER facility_profiles_sync_verified
  BEFORE INSERT OR UPDATE ON facility_profiles
  FOR EACH ROW EXECUTE FUNCTION facility_profiles_sync_verified();

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so RLS policies can call them cheaply).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_approved(p_org_id UUID)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM facility_profiles
    WHERE id = p_org_id AND verification_status = 'approved'
  );
$function$;

-- True when the caller is an organization that isn't approved yet.
-- Professionals, clients and admins are never blocked by this.
CREATE OR REPLACE FUNCTION public.caller_org_not_approved()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM facility_profiles
    WHERE id = auth.uid() AND verification_status <> 'approved'
  );
$function$;

REVOKE ALL ON FUNCTION public.is_org_approved(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.caller_org_not_approved() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_approved(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.caller_org_not_approved() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- jobs: drafts always; publishing needs an approved org.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_org_approved_to_publish()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status <> 'draft'
     AND (TG_OP = 'INSERT' OR OLD.status = 'draft')
     AND NOT is_privileged_writer()
     AND NOT is_org_approved(NEW.facility_id) THEN
    RAISE EXCEPTION 'Your organization is under review. You can save drafts now and publish once you''re approved.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS jobs_require_approved_org ON jobs;
CREATE TRIGGER jobs_require_approved_org
  BEFORE INSERT OR UPDATE OF status ON jobs
  FOR EACH ROW EXECUTE FUNCTION enforce_org_approved_to_publish();

DROP POLICY IF EXISTS "jobs_select_open" ON jobs;
CREATE POLICY "jobs_select_open"
  ON jobs FOR SELECT
  USING (
    (status = 'open' AND is_org_approved(facility_id))
    OR facility_id = auth.uid()
    OR is_admin()
  );

-- ---------------------------------------------------------------------------
-- Messaging: unapproved orgs can't start conversations or send messages.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "conversations_insert_participant" ON conversations;
CREATE POLICY "conversations_insert_participant"
  ON conversations FOR INSERT
  WITH CHECK (
    (participant_1 = auth.uid() OR participant_2 = auth.uid())
    AND NOT caller_org_not_approved()
  );

DROP POLICY IF EXISTS "messages_insert_sender" ON messages;
CREATE POLICY "messages_insert_sender"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT caller_org_not_approved()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Applicants: only approved orgs can move them through the pipeline.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "job_applications_update_facility" ON job_applications;
CREATE POLICY "job_applications_update_facility"
  ON job_applications FOR UPDATE
  USING (
    is_org_approved(auth.uid())
    AND EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id AND j.facility_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Visibility: approved orgs, your own org, admins, and orgs you already work
-- with (conversation or contract), so existing threads keep their names.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "facility_profiles_select_public" ON facility_profiles;
CREATE POLICY "facility_profiles_select_public"
  ON facility_profiles FOR SELECT
  USING (
    verification_status = 'approved'
    OR id = auth.uid()
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM conversations c
      WHERE (c.participant_1 = auth.uid() AND c.participant_2 = facility_profiles.id)
         OR (c.participant_2 = auth.uid() AND c.participant_1 = facility_profiles.id)
    )
    OR EXISTS (
      SELECT 1 FROM contracts k
      WHERE k.facility_id = facility_profiles.id AND k.contractor_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Review evidence (screenshot/PDF of each lookup), admin-only. Files live in
-- the private 'verification-evidence' bucket under org/{facility_id}/...
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_verification_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  check_key TEXT NOT NULL CHECK (char_length(check_key) BETWEEN 1 AND 100),
  storage_path TEXT CHECK (storage_path IS NULL OR char_length(storage_path) <= 1024),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 5000),
  created_by UUID DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_verification_evidence_facility
  ON org_verification_evidence (facility_id, check_key);

ALTER TABLE org_verification_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON org_verification_evidence FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_verification_evidence TO authenticated;
GRANT ALL ON org_verification_evidence TO service_role;

DROP POLICY IF EXISTS "org_verification_evidence_all_admin" ON org_verification_evidence;
CREATE POLICY "org_verification_evidence_all_admin"
  ON org_verification_evidence FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));
