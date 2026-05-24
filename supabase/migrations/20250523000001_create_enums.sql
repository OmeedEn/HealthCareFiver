-- 00001_create_enums.sql
-- Create all enum types for the HealthGig platform

CREATE TYPE user_role AS ENUM (
  'contractor',
  'facility',
  'staffing_agency',
  'admin'
);

CREATE TYPE contractor_type AS ENUM (
  'rn', 'lpn', 'cna', 'np', 'pa', 'md', 'do',
  'pt', 'ot', 'slp', 'rt', 'pharm', 'rad_tech',
  'lab_tech', 'ma', 'emt', 'sw', 'other'
);

CREATE TYPE facility_type AS ENUM (
  'hospital', 'clinic', 'nursing_home', 'assisted_living',
  'home_health', 'rehab_center', 'urgent_care', 'telehealth',
  'staffing_agency', 'other'
);

CREATE TYPE credential_type AS ENUM (
  'license', 'certification', 'degree', 'cpr_bls', 'acls',
  'pals', 'npi', 'dea', 'malpractice_insurance',
  'background_check', 'drug_screen', 'immunization',
  'tb_test', 'fit_test', 'other'
);

CREATE TYPE credential_status AS ENUM (
  'pending_upload', 'pending_review', 'verified',
  'rejected', 'expired', 'expiring_soon'
);

CREATE TYPE job_status AS ENUM (
  'draft', 'open', 'filled', 'in_progress',
  'completed', 'cancelled'
);

CREATE TYPE job_type AS ENUM (
  'per_diem', 'travel', 'contract', 'permanent', 'locum_tenens'
);

CREATE TYPE shift_type AS ENUM (
  'day', 'evening', 'night', 'rotating', 'flexible'
);

CREATE TYPE application_status AS ENUM (
  'applied', 'shortlisted', 'interviewing', 'offered',
  'accepted', 'rejected', 'withdrawn'
);

CREATE TYPE contract_status AS ENUM (
  'draft', 'pending_contractor', 'pending_facility',
  'active', 'completed', 'disputed', 'cancelled', 'terminated'
);

CREATE TYPE timesheet_status AS ENUM (
  'draft', 'submitted', 'approved', 'disputed', 'paid'
);

CREATE TYPE payment_status AS ENUM (
  'pending', 'processing', 'in_escrow', 'released',
  'refunded', 'failed', 'disputed'
);

CREATE TYPE notification_type AS ENUM (
  'application_received', 'application_status_change',
  'new_message', 'contract_update', 'payment_received',
  'payment_released', 'credential_expiring', 'credential_verified',
  'credential_rejected', 'review_received', 'job_match',
  'timesheet_submitted', 'timesheet_approved', 'dispute_opened',
  'system'
);

CREATE TYPE dispute_status AS ENUM (
  'open', 'under_review', 'resolved_contractor',
  'resolved_facility', 'escalated', 'closed'
);
