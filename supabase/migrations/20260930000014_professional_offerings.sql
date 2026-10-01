-- 20260930000014_professional_offerings.sql
-- Onboarding step 5 "What will you offer?": services, consulting, events.
-- Owners manage their own rows; admins manage all; anyone (anon included)
-- can read published offerings of professionals who can go live.

CREATE TABLE IF NOT EXISTS professional_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'consulting', 'event')),
  title TEXT NOT NULL CHECK (char_length(BTRIM(title)) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 5000),
  -- services
  format TEXT CHECK (format IS NULL OR format IN ('virtual', 'in_person', 'home_visit')),
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  -- consulting
  engagement_type TEXT,
  custom_quote BOOLEAN NOT NULL DEFAULT FALSE,
  -- events
  event_type TEXT,
  starts_at TIMESTAMPTZ,              -- NULL = "date later"
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  -- pricing
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_professional_offerings_contractor
  ON professional_offerings (contractor_id);
CREATE INDEX IF NOT EXISTS idx_professional_offerings_published
  ON professional_offerings (kind, contractor_id)
  WHERE status = 'published';

DROP TRIGGER IF EXISTS professional_offerings_updated_at ON professional_offerings;
CREATE TRIGGER professional_offerings_updated_at
  BEFORE UPDATE ON professional_offerings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE professional_offerings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON professional_offerings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON professional_offerings TO authenticated;
GRANT ALL ON professional_offerings TO service_role;

-- Owner: full CRUD on own rows. The FK to contractor_profiles means only a
-- contractor can own rows.
DROP POLICY IF EXISTS "professional_offerings_select_own" ON professional_offerings;
CREATE POLICY "professional_offerings_select_own"
  ON professional_offerings FOR SELECT
  TO authenticated
  USING (contractor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "professional_offerings_insert_own" ON professional_offerings;
CREATE POLICY "professional_offerings_insert_own"
  ON professional_offerings FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "professional_offerings_update_own" ON professional_offerings;
CREATE POLICY "professional_offerings_update_own"
  ON professional_offerings FOR UPDATE
  TO authenticated
  USING (contractor_id = (SELECT auth.uid()))
  WITH CHECK (contractor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "professional_offerings_delete_own" ON professional_offerings;
CREATE POLICY "professional_offerings_delete_own"
  ON professional_offerings FOR DELETE
  TO authenticated
  USING (contractor_id = (SELECT auth.uid()));

-- Admins: everything.
DROP POLICY IF EXISTS "professional_offerings_all_admin" ON professional_offerings;
CREATE POLICY "professional_offerings_all_admin"
  ON professional_offerings FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Public: published offerings of live professionals.
DROP POLICY IF EXISTS "professional_offerings_select_published" ON professional_offerings;
CREATE POLICY "professional_offerings_select_published"
  ON professional_offerings FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND can_go_live(contractor_id));
