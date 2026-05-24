-- 00003_create_credentials.sql
-- Create credentials and required_credentials tables, seed required credentials

CREATE TABLE credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id UUID NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
  credential_type credential_type NOT NULL,
  name TEXT NOT NULL,
  issuing_authority TEXT,
  license_number TEXT,
  issued_date DATE,
  expiration_date DATE,
  status credential_status NOT NULL DEFAULT 'pending_upload',
  document_url TEXT,
  document_filename TEXT,
  verification_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES profiles(id),
  auto_verified BOOLEAN NOT NULL DEFAULT FALSE,
  expiry_alert_30_sent BOOLEAN NOT NULL DEFAULT FALSE,
  expiry_alert_60_sent BOOLEAN NOT NULL DEFAULT FALSE,
  expiry_alert_90_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_credentials_contractor ON credentials(contractor_id);
CREATE INDEX idx_credentials_status ON credentials(status);
CREATE INDEX idx_credentials_expiration ON credentials(expiration_date);

-- required_credentials table
CREATE TABLE required_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_type contractor_type NOT NULL,
  credential_type credential_type NOT NULL,
  name TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  UNIQUE (contractor_type, credential_type, name)
);

-- Seed required credentials for RN
INSERT INTO required_credentials (contractor_type, credential_type, name, is_mandatory, description) VALUES
  ('rn', 'license', 'RN State License', TRUE, 'Active Registered Nurse license for the state of practice'),
  ('rn', 'cpr_bls', 'BLS Certification', TRUE, 'Basic Life Support certification'),
  ('rn', 'background_check', 'Background Check', TRUE, 'Current background check clearance'),
  ('rn', 'drug_screen', 'Drug Screen', TRUE, 'Current drug screening results'),
  ('rn', 'immunization', 'Immunization Records', TRUE, 'Up-to-date immunization records'),
  ('rn', 'tb_test', 'TB Test', TRUE, 'Current TB test results'),
  ('rn', 'acls', 'ACLS Certification', FALSE, 'Advanced Cardiovascular Life Support certification'),
  ('rn', 'pals', 'PALS Certification', FALSE, 'Pediatric Advanced Life Support certification');

-- Seed required credentials for LPN
INSERT INTO required_credentials (contractor_type, credential_type, name, is_mandatory, description) VALUES
  ('lpn', 'license', 'LPN State License', TRUE, 'Active Licensed Practical Nurse license'),
  ('lpn', 'cpr_bls', 'BLS Certification', TRUE, 'Basic Life Support certification'),
  ('lpn', 'background_check', 'Background Check', TRUE, 'Current background check clearance'),
  ('lpn', 'drug_screen', 'Drug Screen', TRUE, 'Current drug screening results'),
  ('lpn', 'immunization', 'Immunization Records', TRUE, 'Up-to-date immunization records'),
  ('lpn', 'tb_test', 'TB Test', TRUE, 'Current TB test results');

-- Seed required credentials for CNA
INSERT INTO required_credentials (contractor_type, credential_type, name, is_mandatory, description) VALUES
  ('cna', 'certification', 'CNA Certification', TRUE, 'Active Certified Nursing Assistant certification'),
  ('cna', 'cpr_bls', 'BLS Certification', TRUE, 'Basic Life Support certification'),
  ('cna', 'background_check', 'Background Check', TRUE, 'Current background check clearance'),
  ('cna', 'drug_screen', 'Drug Screen', TRUE, 'Current drug screening results'),
  ('cna', 'immunization', 'Immunization Records', TRUE, 'Up-to-date immunization records'),
  ('cna', 'tb_test', 'TB Test', TRUE, 'Current TB test results');

-- Seed required credentials for MD
INSERT INTO required_credentials (contractor_type, credential_type, name, is_mandatory, description) VALUES
  ('md', 'license', 'MD State License', TRUE, 'Active Medical Doctor license for the state of practice'),
  ('md', 'dea', 'DEA Registration', TRUE, 'Active DEA registration'),
  ('md', 'npi', 'NPI Number', TRUE, 'National Provider Identifier'),
  ('md', 'malpractice_insurance', 'Malpractice Insurance', TRUE, 'Active malpractice insurance policy'),
  ('md', 'cpr_bls', 'BLS Certification', TRUE, 'Basic Life Support certification'),
  ('md', 'acls', 'ACLS Certification', TRUE, 'Advanced Cardiovascular Life Support certification'),
  ('md', 'background_check', 'Background Check', TRUE, 'Current background check clearance'),
  ('md', 'drug_screen', 'Drug Screen', TRUE, 'Current drug screening results'),
  ('md', 'degree', 'Medical Degree', TRUE, 'Doctor of Medicine degree from accredited institution');
