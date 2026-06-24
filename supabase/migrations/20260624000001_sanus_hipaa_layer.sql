-- Sanus HIPAA layer
--   1. Clamp admin role at signup (CVE-fix for privilege escalation via
--      raw_user_meta_data.role at the public auth endpoint).
--   2. Create append-only audit_log for PHI/sensitive-data access. Distinct
--      from admin_audit_log (which tracks admin-action history) — this one is
--      the HIPAA Security Rule §164.312(b) audit control.

-- ---------------------------------------------------------------------------
-- 1. handle_new_user role clamp
-- ---------------------------------------------------------------------------
-- The public anon key can call Supabase's auth.signUp directly with arbitrary
-- raw_user_meta_data. Without this clamp, a self-service admin promotion is
-- one curl away. The API route's Zod check is not a security boundary.
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

  -- admin must be granted server-side; never accept it from public signup.
  IF _role = 'admin' THEN
    _role := 'contractor';
  END IF;

  _first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
  _last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
  _facility_name := COALESCE(NEW.raw_user_meta_data->>'facility_name', '');
  _contractor_type := COALESCE((NEW.raw_user_meta_data->>'contractor_type')::contractor_type, 'other');
  _facility_type := COALESCE((NEW.raw_user_meta_data->>'facility_type')::facility_type, 'other');

  INSERT INTO profiles (id, role, email)
  VALUES (NEW.id, _role, NEW.email);

  IF _role = 'contractor' THEN
    INSERT INTO contractor_profiles (id, first_name, last_name, contractor_type)
    VALUES (NEW.id, _first_name, _last_name, _contractor_type);
  ELSIF _role = 'facility' OR _role = 'staffing_agency' THEN
    INSERT INTO facility_profiles (id, facility_name, facility_type)
    VALUES (NEW.id, _facility_name, _facility_type);
  END IF;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- 2. audit_log (HIPAA PHI access log)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role user_role,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  phi_accessed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_phi ON audit_log(phi_accessed) WHERE phi_accessed = TRUE;

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Append-only: any authenticated user can write their own action; only admin
-- can read; nobody can update or delete. The service-role bypasses RLS for
-- the retention worker (which only DELETEs rows older than 6 years).
CREATE POLICY "audit_log_insert_self"
  ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE POLICY "audit_log_select_admin"
  ON audit_log FOR SELECT
  TO authenticated
  USING (is_admin());

-- No UPDATE or DELETE policies — append-only at the RLS layer. Retention
-- worker uses service-role key, which bypasses RLS entirely.
