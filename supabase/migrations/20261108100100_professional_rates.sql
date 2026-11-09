-- 20261108100100_professional_rates.sql
-- Flexible rates for professionals, kept separate from availability.
-- A professional can list any number of rates, each with its own unit
-- (per session, hour, day, week, month, package, or a custom label).
-- Rates are shown only on the full profile page, never on search cards.

CREATE TABLE IF NOT EXISTS professional_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(BTRIM(label)) BETWEEN 1 AND 120),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 1000),
  unit TEXT NOT NULL CHECK (unit IN ('session', 'hour', 'day', 'week', 'month', 'package', 'custom')),
  -- Only for unit = 'custom' ("per visit", "per 10-pack") or package size notes.
  unit_label TEXT CHECK (unit_label IS NULL OR char_length(unit_label) <= 60),
  -- Minutes in one session (unit = 'session'), optional.
  duration_minutes INTEGER CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  -- Optional upper bound for a range ("$80–$120 / hour").
  amount_max_cents INTEGER CHECK (amount_max_cents IS NULL OR amount_max_cents >= 0),
  -- "Contact for pricing" instead of a number.
  on_request BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (on_request OR amount_cents IS NOT NULL),
  CHECK (amount_max_cents IS NULL OR amount_cents IS NULL OR amount_max_cents >= amount_cents)
);

CREATE INDEX IF NOT EXISTS idx_professional_rates_contractor
  ON professional_rates (contractor_id, sort_order);

DROP TRIGGER IF EXISTS professional_rates_updated_at ON professional_rates;
CREATE TRIGGER professional_rates_updated_at
  BEFORE UPDATE ON professional_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE professional_rates ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON professional_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON professional_rates TO authenticated;
GRANT ALL ON professional_rates TO service_role;

DROP POLICY IF EXISTS "professional_rates_own" ON professional_rates;
CREATE POLICY "professional_rates_own"
  ON professional_rates FOR ALL
  TO authenticated
  USING (contractor_id = (SELECT auth.uid()))
  WITH CHECK (contractor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "professional_rates_admin" ON professional_rates;
CREATE POLICY "professional_rates_admin"
  ON professional_rates FOR ALL
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- Public: active rates of live professionals (profile page only).
DROP POLICY IF EXISTS "professional_rates_public" ON professional_rates;
CREATE POLICY "professional_rates_public"
  ON professional_rates FOR SELECT
  TO anon, authenticated
  USING (is_active AND can_go_live(contractor_id));
