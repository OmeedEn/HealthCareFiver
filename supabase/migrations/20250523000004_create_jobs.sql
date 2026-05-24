-- 00004_create_jobs.sql
-- Create jobs, job_applications, saved_jobs tables with triggers and indexes

CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  contractor_type contractor_type NOT NULL,
  specialties_required TEXT[],
  job_type job_type NOT NULL,
  shift_type shift_type NOT NULL,
  status job_status NOT NULL DEFAULT 'draft',
  -- Location
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  is_remote BOOLEAN NOT NULL DEFAULT FALSE,
  -- Compensation
  hourly_rate_min NUMERIC(10,2),
  hourly_rate_max NUMERIC(10,2),
  overtime_rate NUMERIC(10,2),
  signing_bonus NUMERIC(10,2),
  travel_reimbursement BOOLEAN NOT NULL DEFAULT FALSE,
  housing_provided BOOLEAN NOT NULL DEFAULT FALSE,
  -- Schedule
  start_date DATE,
  end_date DATE,
  shift_start_time TIME,
  shift_end_time TIME,
  hours_per_week NUMERIC(5,2),
  -- Requirements
  years_experience_required INTEGER,
  required_certifications TEXT[],
  required_skills TEXT[],
  dress_code TEXT,
  additional_requirements TEXT,
  -- Meta
  total_applicants INTEGER NOT NULL DEFAULT 0,
  positions_available INTEGER NOT NULL DEFAULT 1,
  positions_filled INTEGER NOT NULL DEFAULT 0,
  urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  search_vector TSVECTOR,
  published_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Job search vector trigger
CREATE OR REPLACE FUNCTION update_job_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.title, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.description, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.contractor_type::TEXT, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(ARRAY_TO_STRING(NEW.specialties_required, ' '), '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.city, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.state, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_search_vector
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_job_search_vector();

-- Indexes on jobs
CREATE INDEX idx_jobs_facility ON jobs(facility_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_contractor_type ON jobs(contractor_type);
CREATE INDEX idx_jobs_location ON jobs(state, city);
CREATE INDEX idx_jobs_search_vector ON jobs USING GIN(search_vector);
CREATE INDEX idx_jobs_published_at ON jobs(published_at);
CREATE INDEX idx_jobs_expires_at ON jobs(expires_at);

-- job_applications table
CREATE TABLE job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  status application_status NOT NULL DEFAULT 'applied',
  cover_letter TEXT,
  proposed_rate NUMERIC(10,2),
  available_start_date DATE,
  notes TEXT,
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, contractor_id)
);

CREATE TRIGGER job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_job_applications_job ON job_applications(job_id);
CREATE INDEX idx_job_applications_contractor ON job_applications(contractor_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

-- Trigger to update total_applicants on jobs
CREATE OR REPLACE FUNCTION update_job_applicant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE jobs SET total_applicants = total_applicants + 1 WHERE id = NEW.job_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE jobs SET total_applicants = total_applicants - 1 WHERE id = OLD.job_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_applications_count
  AFTER INSERT OR DELETE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_job_applicant_count();

-- saved_jobs table
CREATE TABLE saved_jobs (
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contractor_id, job_id)
);
