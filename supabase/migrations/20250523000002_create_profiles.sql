-- 00002_create_profiles.sql
-- Create profiles, contractor_profiles, facility_profiles, contractor_availability
-- Plus triggers for search vector, updated_at, and new user handling

-- Reusable trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_customer_id TEXT,
  stripe_connect_id TEXT,
  stripe_connect_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- contractor_profiles table
CREATE TABLE contractor_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  contractor_type contractor_type NOT NULL,
  specialties TEXT[],
  headline TEXT,
  bio TEXT,
  years_of_experience INTEGER,
  hourly_rate_min NUMERIC(10,2),
  hourly_rate_max NUMERIC(10,2),
  npi_number TEXT,
  state_license_number TEXT,
  license_state TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  willing_to_travel BOOLEAN NOT NULL DEFAULT FALSE,
  travel_radius_miles INTEGER,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  profile_completion_pct INTEGER NOT NULL DEFAULT 0,
  total_jobs_completed INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contractor_profiles_updated_at
  BEFORE UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes on contractor_profiles
CREATE INDEX idx_contractor_profiles_type ON contractor_profiles(contractor_type);
CREATE INDEX idx_contractor_profiles_location ON contractor_profiles(state, city);
CREATE INDEX idx_contractor_profiles_search_vector ON contractor_profiles USING GIN(search_vector);
CREATE INDEX idx_contractor_profiles_is_available ON contractor_profiles(is_available);

-- Search vector trigger for contractor_profiles
CREATE OR REPLACE FUNCTION update_contractor_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.first_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.last_name, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.headline, '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.bio, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.contractor_type::TEXT, '')), 'A') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(ARRAY_TO_STRING(NEW.specialties, ' '), '')), 'B') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.city, '')), 'C') ||
    SETWEIGHT(TO_TSVECTOR('english', COALESCE(NEW.state, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contractor_profiles_search_vector
  BEFORE INSERT OR UPDATE ON contractor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_contractor_search_vector();

-- facility_profiles table
CREATE TABLE facility_profiles (
  id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  facility_name TEXT NOT NULL,
  facility_type facility_type NOT NULL,
  description TEXT,
  website TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  ein TEXT,
  total_jobs_posted INTEGER NOT NULL DEFAULT 0,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER facility_profiles_updated_at
  BEFORE UPDATE ON facility_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- contractor_availability table
CREATE TABLE contractor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER,
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contractor_availability_contractor ON contractor_availability(contractor_id);

-- Auth trigger: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role user_role;
  _first_name TEXT;
  _last_name TEXT;
  _facility_name TEXT;
  _contractor_type contractor_type;
  _facility_type facility_type;
BEGIN
  _role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'contractor');
  _first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  _last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  _facility_name := COALESCE(NEW.raw_user_meta_data->>'facility_name', '');
  _contractor_type := COALESCE((NEW.raw_user_meta_data->>'contractor_type')::contractor_type, 'other');
  _facility_type := COALESCE((NEW.raw_user_meta_data->>'facility_type')::facility_type, 'other');

  -- Create base profile
  INSERT INTO profiles (id, role, email)
  VALUES (NEW.id, _role, NEW.email);

  -- Create role-specific profile
  IF _role = 'contractor' THEN
    INSERT INTO contractor_profiles (id, first_name, last_name, contractor_type)
    VALUES (NEW.id, _first_name, _last_name, _contractor_type);
  ELSIF _role = 'facility' OR _role = 'staffing_agency' THEN
    INSERT INTO facility_profiles (id, facility_name, facility_type)
    VALUES (NEW.id, _facility_name, _facility_type);
  END IF;

  -- Create default notification preferences
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
