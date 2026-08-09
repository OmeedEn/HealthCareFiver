-- 00010_create_admin.sql
-- Create disputes, admin_audit_log, platform_config tables with seed data

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  opened_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  against UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status dispute_status NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL,
  description TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_disputes_contract ON disputes(contract_id);
CREATE INDEX idx_disputes_opened_by ON disputes(opened_by);
CREATE INDEX idx_disputes_against ON disputes(against);
CREATE INDEX idx_disputes_status ON disputes(status);

CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

CREATE TABLE platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed platform_config with defaults
INSERT INTO platform_config (key, value, description) VALUES
  ('platform_fee_pct', '10'::JSONB, 'Default platform fee percentage charged on contracts'),
  ('min_hourly_rate', '15.00'::JSONB, 'Minimum allowed hourly rate for jobs'),
  ('max_hourly_rate', '500.00'::JSONB, 'Maximum allowed hourly rate for jobs'),
  ('escrow_hold_days', '3'::JSONB, 'Number of days to hold payment in escrow after approval'),
  ('credential_expiry_alert_days', '[30, 60, 90]'::JSONB, 'Days before expiry to send credential alerts'),
  ('max_travel_radius_miles', '500'::JSONB, 'Maximum travel radius allowed for contractor search'),
  ('auto_verify_credentials', 'false'::JSONB, 'Whether to auto-verify credentials via third-party API'),
  ('maintenance_mode', 'false'::JSONB, 'Whether the platform is in maintenance mode'),
  ('support_email', '"support@sanus.com"'::JSONB, 'Platform support email address'),
  ('terms_version', '"1.0.0"'::JSONB, 'Current version of terms of service');
