-- 00008_create_reviews.sql
-- Create reviews table with rating update trigger

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT,
  -- Category ratings
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  skill_rating INTEGER CHECK (skill_rating >= 1 AND skill_rating <= 5),
  punctuality_rating INTEGER CHECK (punctuality_rating >= 1 AND punctuality_rating <= 5),
  would_work_again_rating INTEGER CHECK (would_work_again_rating >= 1 AND would_work_again_rating <= 5),
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  admin_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, reviewer_id)
);

CREATE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_reviews_contract ON reviews(contract_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Trigger to update average_rating on contractor_profiles or facility_profiles
CREATE OR REPLACE FUNCTION update_reviewee_rating()
RETURNS TRIGGER AS $$
DECLARE
  _avg NUMERIC(3,2);
  _count INTEGER;
  _role user_role;
BEGIN
  -- Calculate new average and count
  SELECT AVG(rating)::NUMERIC(3,2), COUNT(*)
  INTO _avg, _count
  FROM reviews
  WHERE reviewee_id = NEW.reviewee_id AND is_visible = TRUE AND admin_hidden = FALSE;

  -- Determine role of reviewee
  SELECT role INTO _role FROM profiles WHERE id = NEW.reviewee_id;

  IF _role = 'contractor' THEN
    UPDATE contractor_profiles
    SET average_rating = COALESCE(_avg, 0), total_reviews = _count
    WHERE id = NEW.reviewee_id;
  ELSIF _role IN ('facility', 'staffing_agency') THEN
    UPDATE facility_profiles
    SET average_rating = COALESCE(_avg, 0), total_reviews = _count
    WHERE id = NEW.reviewee_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_update_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_reviewee_rating();
