-- 00011_create_rls_policies.sql
-- Enable RLS on all tables and create access policies

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Enable RLS on ALL tables
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facility_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contractor_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE required_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- CONTRACTOR_PROFILES
-- ============================================================
CREATE POLICY "contractor_profiles_select_public"
  ON contractor_profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "contractor_profiles_update_own"
  ON contractor_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "contractor_profiles_update_admin"
  ON contractor_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- FACILITY_PROFILES
-- ============================================================
CREATE POLICY "facility_profiles_select_public"
  ON facility_profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "facility_profiles_update_own"
  ON facility_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "facility_profiles_update_admin"
  ON facility_profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- CONTRACTOR_AVAILABILITY
-- ============================================================
CREATE POLICY "contractor_availability_select_own"
  ON contractor_availability FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "contractor_availability_insert_own"
  ON contractor_availability FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "contractor_availability_update_own"
  ON contractor_availability FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "contractor_availability_delete_own"
  ON contractor_availability FOR DELETE
  TO authenticated
  USING (contractor_id = auth.uid());

-- ============================================================
-- CREDENTIALS
-- ============================================================
CREATE POLICY "credentials_select_own"
  ON credentials FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "credentials_select_admin"
  ON credentials FOR SELECT
  TO authenticated
  USING (is_admin());

-- Facilities with an active contract can see verified credentials
CREATE POLICY "credentials_select_contracted_facility"
  ON credentials FOR SELECT
  TO authenticated
  USING (
    status = 'verified'
    AND EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.contractor_id = credentials.contractor_id
        AND c.facility_id = auth.uid()
        AND c.status IN ('active', 'pending_contractor', 'pending_facility')
    )
  );

CREATE POLICY "credentials_insert_own"
  ON credentials FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "credentials_update_own"
  ON credentials FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "credentials_update_admin"
  ON credentials FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- REQUIRED_CREDENTIALS (read-only for all authenticated)
-- ============================================================
CREATE POLICY "required_credentials_select_all"
  ON required_credentials FOR SELECT
  TO authenticated
  USING (TRUE);

-- ============================================================
-- JOBS
-- ============================================================
CREATE POLICY "jobs_select_open"
  ON jobs FOR SELECT
  TO authenticated
  USING (status = 'open' OR facility_id = auth.uid() OR is_admin());

CREATE POLICY "jobs_insert_facility"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (facility_id = auth.uid());

CREATE POLICY "jobs_update_own"
  ON jobs FOR UPDATE
  TO authenticated
  USING (facility_id = auth.uid())
  WITH CHECK (facility_id = auth.uid());

CREATE POLICY "jobs_update_admin"
  ON jobs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- JOB_APPLICATIONS
-- ============================================================
CREATE POLICY "job_applications_select_contractor"
  ON job_applications FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "job_applications_select_facility"
  ON job_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.facility_id = auth.uid()
    )
  );

CREATE POLICY "job_applications_select_admin"
  ON job_applications FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "job_applications_insert_contractor"
  ON job_applications FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "job_applications_update_contractor"
  ON job_applications FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "job_applications_update_facility"
  ON job_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_applications.job_id
        AND j.facility_id = auth.uid()
    )
  );

CREATE POLICY "job_applications_update_admin"
  ON job_applications FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- SAVED_JOBS
-- ============================================================
CREATE POLICY "saved_jobs_select_own"
  ON saved_jobs FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

CREATE POLICY "saved_jobs_insert_own"
  ON saved_jobs FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "saved_jobs_delete_own"
  ON saved_jobs FOR DELETE
  TO authenticated
  USING (contractor_id = auth.uid());

-- ============================================================
-- CONTRACTS
-- ============================================================
CREATE POLICY "contracts_select_parties"
  ON contracts FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid() OR facility_id = auth.uid() OR is_admin());

CREATE POLICY "contracts_insert_facility"
  ON contracts FOR INSERT
  TO authenticated
  WITH CHECK (facility_id = auth.uid());

CREATE POLICY "contracts_update_contractor"
  ON contracts FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid())
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "contracts_update_facility"
  ON contracts FOR UPDATE
  TO authenticated
  USING (facility_id = auth.uid())
  WITH CHECK (facility_id = auth.uid());

CREATE POLICY "contracts_update_admin"
  ON contracts FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- TIMESHEETS
-- ============================================================
CREATE POLICY "timesheets_select_parties"
  ON timesheets FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid() OR facility_id = auth.uid() OR is_admin());

CREATE POLICY "timesheets_insert_contractor"
  ON timesheets FOR INSERT
  TO authenticated
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "timesheets_update_contractor_draft"
  ON timesheets FOR UPDATE
  TO authenticated
  USING (contractor_id = auth.uid() AND status = 'draft')
  WITH CHECK (contractor_id = auth.uid());

CREATE POLICY "timesheets_update_facility_submitted"
  ON timesheets FOR UPDATE
  TO authenticated
  USING (facility_id = auth.uid() AND status = 'submitted')
  WITH CHECK (facility_id = auth.uid());

CREATE POLICY "timesheets_update_admin"
  ON timesheets FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- CONVERSATIONS
-- ============================================================
CREATE POLICY "conversations_select_participant"
  ON conversations FOR SELECT
  TO authenticated
  USING (participant_1 = auth.uid() OR participant_2 = auth.uid() OR is_admin());

CREATE POLICY "conversations_insert_participant"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE POLICY "messages_select_participant"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
    OR is_admin()
  );

CREATE POLICY "messages_insert_sender"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "messages_update_read"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE POLICY "payments_select_parties"
  ON payments FOR SELECT
  TO authenticated
  USING (payer_id = auth.uid() OR payee_id = auth.uid() OR is_admin());

CREATE POLICY "payments_insert_admin"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (payer_id = auth.uid() OR is_admin());

CREATE POLICY "payments_update_admin"
  ON payments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- PLATFORM_FEES (admin only)
-- ============================================================
CREATE POLICY "platform_fees_select_admin"
  ON platform_fees FOR SELECT
  TO authenticated
  USING (is_admin());

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE POLICY "reviews_select_visible"
  ON reviews FOR SELECT
  TO authenticated
  USING (is_visible = TRUE AND admin_hidden = FALSE);

CREATE POLICY "reviews_select_admin"
  ON reviews FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "reviews_insert_party"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.id = contract_id
        AND c.status = 'completed'
        AND (c.contractor_id = auth.uid() OR c.facility_id = auth.uid())
    )
  );

CREATE POLICY "reviews_update_own"
  ON reviews FOR UPDATE
  TO authenticated
  USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

CREATE POLICY "reviews_update_admin"
  ON reviews FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- NOTIFICATION_PREFERENCES
-- ============================================================
CREATE POLICY "notification_preferences_select_own"
  ON notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notification_preferences_update_own"
  ON notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- DISPUTES
-- ============================================================
CREATE POLICY "disputes_select_parties"
  ON disputes FOR SELECT
  TO authenticated
  USING (opened_by = auth.uid() OR against = auth.uid() OR is_admin());

CREATE POLICY "disputes_insert_party"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (opened_by = auth.uid());

CREATE POLICY "disputes_update_admin"
  ON disputes FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- ADMIN_AUDIT_LOG (admin only)
-- ============================================================
CREATE POLICY "admin_audit_log_select_admin"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "admin_audit_log_insert_admin"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ============================================================
-- PLATFORM_CONFIG (admin read/write, authenticated read)
-- ============================================================
CREATE POLICY "platform_config_select_all"
  ON platform_config FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "platform_config_update_admin"
  ON platform_config FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "platform_config_insert_admin"
  ON platform_config FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
