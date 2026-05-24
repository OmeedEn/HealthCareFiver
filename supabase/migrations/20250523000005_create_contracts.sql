-- 00005_create_contracts.sql
-- Create contracts and timesheets tables

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  application_id UUID REFERENCES job_applications(id) ON DELETE SET NULL,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  status contract_status NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL,
  description TEXT,
  agreed_rate NUMERIC(10,2) NOT NULL,
  rate_type TEXT NOT NULL DEFAULT 'hourly' CHECK (rate_type IN ('hourly', 'daily', 'flat')),
  overtime_rate NUMERIC(10,2),
  estimated_hours NUMERIC(10,2),
  total_value NUMERIC(12,2),
  platform_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
  -- Schedule
  start_date DATE NOT NULL,
  end_date DATE,
  shift_start_time TIME,
  shift_end_time TIME,
  days_of_week INTEGER[],
  -- Signatures
  contractor_signed_at TIMESTAMPTZ,
  facility_signed_at TIMESTAMPTZ,
  -- Completion / Cancellation
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_contracts_contractor ON contracts(contractor_id);
CREATE INDEX idx_contracts_facility ON contracts(facility_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_job ON contracts(job_id);

-- timesheets table
CREATE TABLE timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facility_profiles(id) ON DELETE CASCADE,
  status timesheet_status NOT NULL DEFAULT 'draft',
  shift_date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER NOT NULL DEFAULT 0,
  total_hours NUMERIC(5,2),
  overtime_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  payment_id UUID, -- FK added in 00007 after payments table exists
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER timesheets_updated_at
  BEFORE UPDATE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_timesheets_contract ON timesheets(contract_id);
CREATE INDEX idx_timesheets_contractor ON timesheets(contractor_id);
CREATE INDEX idx_timesheets_facility ON timesheets(facility_id);
CREATE INDEX idx_timesheets_status ON timesheets(status);
CREATE INDEX idx_timesheets_shift_date ON timesheets(shift_date);
