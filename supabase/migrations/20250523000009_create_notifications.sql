-- 00009_create_notifications.sql
-- Create notifications and notification_preferences tables

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;
CREATE INDEX idx_notifications_type ON notifications(type);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_application_received BOOLEAN NOT NULL DEFAULT TRUE,
  email_application_status_change BOOLEAN NOT NULL DEFAULT TRUE,
  email_new_message BOOLEAN NOT NULL DEFAULT TRUE,
  email_contract_update BOOLEAN NOT NULL DEFAULT TRUE,
  email_payment_received BOOLEAN NOT NULL DEFAULT TRUE,
  email_payment_released BOOLEAN NOT NULL DEFAULT TRUE,
  email_credential_expiring BOOLEAN NOT NULL DEFAULT TRUE,
  email_credential_verified BOOLEAN NOT NULL DEFAULT TRUE,
  email_credential_rejected BOOLEAN NOT NULL DEFAULT TRUE,
  email_review_received BOOLEAN NOT NULL DEFAULT TRUE,
  email_job_match BOOLEAN NOT NULL DEFAULT TRUE,
  email_timesheet_submitted BOOLEAN NOT NULL DEFAULT TRUE,
  email_timesheet_approved BOOLEAN NOT NULL DEFAULT TRUE,
  email_dispute_opened BOOLEAN NOT NULL DEFAULT TRUE,
  email_system BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
