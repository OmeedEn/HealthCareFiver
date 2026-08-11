-- 00001_create_enums.sql
-- Create all enum types for the Sanus platform

DO $$ BEGIN CREATE TYPE user_role AS ENUM (
  'contractor',
  'facility',
  'staffing_agency',
  'admin'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contractor_type AS ENUM (
  'rn', 'lpn', 'cna', 'np', 'pa', 'md', 'do',
  'pt', 'ot', 'slp', 'rt', 'pharm', 'rad_tech',
  'lab_tech', 'ma', 'emt', 'sw', 'other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE facility_type AS ENUM (
  'hospital', 'clinic', 'nursing_home', 'assisted_living',
  'home_health', 'rehab_center', 'urgent_care', 'telehealth',
  'staffing_agency', 'other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE credential_type AS ENUM (
  'license', 'certification', 'degree', 'cpr_bls', 'acls',
  'pals', 'npi', 'dea', 'malpractice_insurance',
  'background_check', 'drug_screen', 'immunization',
  'tb_test', 'fit_test', 'other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE credential_status AS ENUM (
  'pending_upload', 'pending_review', 'verified',
  'rejected', 'expired', 'expiring_soon'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE job_status AS ENUM (
  'draft', 'open', 'filled', 'in_progress',
  'completed', 'cancelled'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE job_type AS ENUM (
  'per_diem', 'travel', 'contract', 'permanent', 'locum_tenens'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE shift_type AS ENUM (
  'day', 'evening', 'night', 'rotating', 'flexible'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE application_status AS ENUM (
  'applied', 'shortlisted', 'interviewing', 'offered',
  'accepted', 'rejected', 'withdrawn'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE contract_status AS ENUM (
  'draft', 'pending_contractor', 'pending_facility',
  'active', 'completed', 'disputed', 'cancelled', 'terminated'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE timesheet_status AS ENUM (
  'draft', 'submitted', 'approved', 'disputed', 'paid'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE payment_status AS ENUM (
  'pending', 'processing', 'in_escrow', 'released',
  'refunded', 'failed', 'disputed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE notification_type AS ENUM (
  'application_received', 'application_status_change',
  'new_message', 'contract_update', 'payment_received',
  'payment_released', 'credential_expiring', 'credential_verified',
  'credential_rejected', 'review_received', 'job_match',
  'timesheet_submitted', 'timesheet_approved', 'dispute_opened',
  'system'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE dispute_status AS ENUM (
  'open', 'under_review', 'resolved_contractor',
  'resolved_facility', 'escalated', 'closed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
