-- Organization inquiries and team invites (Organization Onboarding spec,
-- "How finding professionals and applying works"):
--   * Orgs click "Send inquiry" or "Invite to join our team" on a profile;
--     the message includes role, engagement type and timeline.
--   * Professionals can accept, decline, or turn inquiries off completely.
--   * Invites are rate-limited per org per day so nobody spam-blasts.
--   * Only approved orgs can send (blocked while under review).

ALTER TABLE contractor_profiles
  ADD COLUMN IF NOT EXISTS accepts_inquiries BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS org_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('inquiry', 'invite')),
  role_title TEXT NOT NULL CHECK (char_length(btrim(role_title)) BETWEEN 1 AND 200),
  engagement_type TEXT NOT NULL CHECK (engagement_type IN (
    'employee', 'independent_contractor', 'per_diem', 'consulting_project', 'volunteer'
  )),
  timeline TEXT NOT NULL CHECK (timeline IN ('immediately', 'within_month', 'exploring')),
  message TEXT CHECK (message IS NULL OR char_length(message) <= 2000),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'accepted', 'declined')),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_inquiries_contractor ON org_inquiries (contractor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_inquiries_facility_day ON org_inquiries (facility_id, created_at DESC);

/** Max inquiries + invites one organization can send in 24 hours. */
CREATE OR REPLACE FUNCTION public.org_inquiry_daily_limit()
 RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 20 $$;

/** Whether a professional accepts inquiries (bypasses contractor_profiles RLS). */
CREATE OR REPLACE FUNCTION public.contractor_accepts_inquiries(p_contractor_id UUID)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM contractor_profiles WHERE id = p_contractor_id AND accepts_inquiries) $$;
REVOKE ALL ON FUNCTION public.contractor_accepts_inquiries(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contractor_accepts_inquiries(UUID) TO authenticated, service_role;

-- Sending rules, enforced for everyone but admins / service role. Runs as the
-- caller (NOT security definer) so is_privileged_writer() sees the real role.
CREATE OR REPLACE FUNCTION public.enforce_org_inquiry_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _sent_today INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_privileged_writer() THEN
      IF NEW.facility_id <> auth.uid() THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
      END IF;
      IF NOT is_org_approved(NEW.facility_id) THEN
        RAISE EXCEPTION 'You can contact professionals once your organization is approved.'
          USING ERRCODE = '42501', HINT = 'org_not_approved';
      END IF;
      IF NOT contractor_accepts_inquiries(NEW.contractor_id) THEN
        RAISE EXCEPTION 'This professional isn’t accepting inquiries right now.'
          USING ERRCODE = '42501', HINT = 'inquiries_off';
      END IF;
      SELECT count(*) INTO _sent_today FROM org_inquiries
      WHERE facility_id = NEW.facility_id AND created_at > NOW() - INTERVAL '24 hours';
      IF _sent_today >= org_inquiry_daily_limit() THEN
        RAISE EXCEPTION 'You’ve reached today’s limit of % inquiries and invites. Try again tomorrow.', org_inquiry_daily_limit()
          USING ERRCODE = '42501', HINT = 'rate_limited';
      END IF;
    END IF;
    NEW.status := 'sent';
    NEW.responded_at := NULL;
    NEW.conversation_id := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE: only the professional responds (sent -> accepted / declined);
  -- nothing else changes.
  IF NOT is_privileged_writer() THEN
    IF auth.uid() <> OLD.contractor_id OR OLD.status <> 'sent' OR NEW.status NOT IN ('accepted', 'declined') THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    IF (NEW.facility_id, NEW.contractor_id, NEW.kind, NEW.role_title, NEW.engagement_type, NEW.timeline, NEW.message)
       IS DISTINCT FROM (OLD.facility_id, OLD.contractor_id, OLD.kind, OLD.role_title, OLD.engagement_type, OLD.timeline, OLD.message) THEN
      RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;
    NEW.responded_at := NOW();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS org_inquiries_rules ON org_inquiries;
CREATE TRIGGER org_inquiries_rules
  BEFORE INSERT OR UPDATE ON org_inquiries
  FOR EACH ROW EXECUTE FUNCTION enforce_org_inquiry_rules();

ALTER TABLE org_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON org_inquiries FROM anon;
GRANT SELECT, INSERT, UPDATE ON org_inquiries TO authenticated;
GRANT ALL ON org_inquiries TO service_role;

DROP POLICY IF EXISTS "org_inquiries_select" ON org_inquiries;
CREATE POLICY "org_inquiries_select" ON org_inquiries FOR SELECT TO authenticated
  USING (facility_id = (SELECT auth.uid()) OR contractor_id = (SELECT auth.uid()) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "org_inquiries_insert" ON org_inquiries;
CREATE POLICY "org_inquiries_insert" ON org_inquiries FOR INSERT TO authenticated
  WITH CHECK (facility_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_inquiries_respond" ON org_inquiries;
CREATE POLICY "org_inquiries_respond" ON org_inquiries FOR UPDATE TO authenticated
  USING (contractor_id = (SELECT auth.uid()))
  WITH CHECK (contractor_id = (SELECT auth.uid()));
