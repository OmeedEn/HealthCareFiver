-- Repair: 20260606000001 and 20260606000002 are recorded as applied on the
-- hosted project, but their objects were never created there (no
-- stripe_webhook_events, no rate_limits / check_rate_limit(), no
-- credentials.rejection_notes, no reviews.category_ratings). The app depends
-- on all of them — e.g. every /api/auth/* rate-limit call fails with
-- PGRST202. This re-applies those changes idempotently so it is a no-op on
-- any database where the June migrations did run.

-- ─────────────────────────────────────────────────────────────
-- 20260606000001: Stripe webhook idempotency
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed_at
  ON stripe_webhook_events (processed_at DESC);

-- Written only by the webhook via the service role.
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 20260606000002 §1–2: contract / job date constraints
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_dates_in_order') THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_dates_in_order
      CHECK (end_date IS NULL OR end_date >= start_date);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_no_overlap_per_contractor') THEN
    ALTER TABLE contracts
      ADD CONSTRAINT contracts_no_overlap_per_contractor
      EXCLUDE USING gist (
        contractor_id WITH =,
        daterange(start_date, COALESCE(end_date, DATE '9999-12-31'), '[]') WITH &&
      )
      WHERE (status IN ('active', 'pending_contractor', 'pending_facility'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_dates_in_order') THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_dates_in_order
      CHECK (end_date IS NULL OR end_date >= start_date);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- §3: reviews.category_ratings
-- ─────────────────────────────────────────────────────────────
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS category_ratings JSONB;

UPDATE reviews
SET category_ratings = jsonb_strip_nulls(jsonb_build_object(
  'professionalism', professionalism_rating,
  'communication', communication_rating,
  'skill', skill_rating,
  'punctuality', punctuality_rating,
  'would_work_again', would_work_again_rating
))
WHERE category_ratings IS NULL
  AND (professionalism_rating IS NOT NULL
    OR communication_rating IS NOT NULL
    OR skill_rating IS NOT NULL
    OR punctuality_rating IS NOT NULL
    OR would_work_again_rating IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- §4: recompute ratings on INSERT/UPDATE/DELETE.
-- Keeps SECURITY DEFINER + pinned search_path from 20260930000008
-- (CREATE OR REPLACE would otherwise reset them).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_reviewee_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

DROP TRIGGER IF EXISTS reviews_update_rating ON reviews;
CREATE TRIGGER reviews_update_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_reviewee_rating();

-- ─────────────────────────────────────────────────────────────
-- §5: credentials.rejection_notes
-- ─────────────────────────────────────────────────────────────
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS rejection_notes TEXT;

-- ─────────────────────────────────────────────────────────────
-- §7: rate limiting (called by src/lib/rate-limit.ts via the service role)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits (window_start);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Service-role only: no RLS policy, and nobody else may call the counter.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
