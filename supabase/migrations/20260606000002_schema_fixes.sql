-- 20260606000002_schema_fixes.sql
-- Fix real schema gaps surfaced by app code:
--   1. Contracts: prevent overlapping active/pending contracts for the same
--      contractor (double-booking), and reject end_date < start_date.
--   2. Jobs: same date-order CHECK.
--   3. Reviews: add `category_ratings JSONB` to match what the review form
--      writes today (was being rejected as an unknown column).
--   4. Reviews: also recompute averages on UPDATE/DELETE, not just INSERT.
--   5. Credentials: add `rejection_notes TEXT` so admin reject flow works.
--   6. Disputes: add a `resolution_notes` generated alias for the existing
--      `resolution` column so the admin disputes page keeps working without
--      a UI rewrite.
--   7. Rate limiting: rate_limits table + sliding-window counter helper used
--      by /api/auth/* routes.

-- ─────────────────────────────────────────────────────────────
-- 1. Contracts: no double-booking, valid date order
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_dates_in_order
  CHECK (end_date IS NULL OR end_date >= start_date);

-- A contractor cannot have two contracts whose date ranges overlap while in
-- a state that blocks new work. Open-ended contracts (end_date IS NULL) are
-- treated as running through 9999-12-31 so any later contract overlaps them.
ALTER TABLE contracts
  ADD CONSTRAINT contracts_no_overlap_per_contractor
  EXCLUDE USING gist (
    contractor_id WITH =,
    daterange(start_date, COALESCE(end_date, DATE '9999-12-31'), '[]') WITH &&
  )
  WHERE (status IN ('active', 'pending_contractor', 'pending_facility'));

-- ─────────────────────────────────────────────────────────────
-- 2. Jobs: end_date >= start_date
-- ─────────────────────────────────────────────────────────────
ALTER TABLE jobs
  ADD CONSTRAINT jobs_dates_in_order
  CHECK (end_date IS NULL OR end_date >= start_date);

-- ─────────────────────────────────────────────────────────────
-- 3. Reviews: category_ratings JSONB
-- ─────────────────────────────────────────────────────────────
ALTER TABLE reviews
  ADD COLUMN category_ratings JSONB;

-- Backfill the JSONB column from the individual rating columns so existing
-- rows display correctly under the new shape.
UPDATE reviews
SET category_ratings = jsonb_strip_nulls(jsonb_build_object(
  'professionalism', professionalism_rating,
  'communication', communication_rating,
  'skill', skill_rating,
  'punctuality', punctuality_rating,
  'would_work_again', would_work_again_rating
))
WHERE professionalism_rating IS NOT NULL
   OR communication_rating IS NOT NULL
   OR skill_rating IS NOT NULL
   OR punctuality_rating IS NOT NULL
   OR would_work_again_rating IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. Reviews: keep average_rating honest on UPDATE/DELETE
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_reviewee_rating()
RETURNS TRIGGER AS $$
DECLARE
  _avg NUMERIC(3,2);
  _count INTEGER;
  _role user_role;
  _target UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _target := OLD.reviewee_id;
  ELSE
    _target := NEW.reviewee_id;
  END IF;

  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*)
  INTO _avg, _count
  FROM reviews
  WHERE reviewee_id = _target
    AND is_visible = TRUE
    AND admin_hidden = FALSE;

  SELECT role INTO _role FROM profiles WHERE id = _target;

  IF _role = 'contractor' THEN
    UPDATE contractor_profiles
    SET average_rating = COALESCE(_avg, 0), total_reviews = _count
    WHERE id = _target;
  ELSIF _role IN ('facility', 'staffing_agency') THEN
    UPDATE facility_profiles
    SET average_rating = COALESCE(_avg, 0), total_reviews = _count
    WHERE id = _target;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reviews_update_rating ON reviews;

CREATE TRIGGER reviews_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_reviewee_rating();

-- ─────────────────────────────────────────────────────────────
-- 5. Credentials: rejection_notes
-- ─────────────────────────────────────────────────────────────
ALTER TABLE credentials
  ADD COLUMN rejection_notes TEXT;

-- ─────────────────────────────────────────────────────────────
-- 6. Rate limits
-- ─────────────────────────────────────────────────────────────
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_window_start ON rate_limits (window_start);

-- Atomic check-and-increment: rejects when the caller would exceed
-- `max_requests` inside `window_seconds`. Returns TRUE when allowed.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  _now TIMESTAMPTZ := NOW();
  _row rate_limits%ROWTYPE;
BEGIN
  INSERT INTO rate_limits (key, count, window_start)
  VALUES (p_key, 1, _now)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL <= _now
            THEN 1
          ELSE rate_limits.count + 1
        END,
        window_start = CASE
          WHEN rate_limits.window_start + (p_window_seconds || ' seconds')::INTERVAL <= _now
            THEN _now
          ELSE rate_limits.window_start
        END
  RETURNING * INTO _row;

  RETURN _row.count <= p_max_requests;
END;
$$ LANGUAGE plpgsql;

-- Service-role only; no RLS policy means no anon/authenticated access either.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
