-- Admin console support.
--   1. bug_reports: user-submitted and auto-captured bugs, triaged in /admin/bugs.
--   2. audit_log drift fix: the live table has resource_type / resource_id /
--      ip columns (not the target_table / target_id / ip_address in
--      20260624000001), so every insert from src/lib/audit/log.ts was failing.
--      The app now writes the live columns; add the one column it lacks.

-- ---------------------------------------------------------------------------
-- 1. bug_reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user', 'auto')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'wont_fix')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 5000),
  page_url TEXT,
  user_agent TEXT,
  error_digest TEXT,
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status_created ON bug_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports(user_id);

DROP TRIGGER IF EXISTS bug_reports_updated_at ON bug_reports;
CREATE TRIGGER bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

-- Users file reports as themselves and can see their own; admins see and
-- triage everything. Admin writes go through the service role.
CREATE POLICY "bug_reports_insert_own"
  ON bug_reports FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'open' AND admin_notes IS NULL);

CREATE POLICY "bug_reports_select_own_or_admin"
  ON bug_reports FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT is_admin()));

CREATE POLICY "bug_reports_update_admin"
  ON bug_reports FOR UPDATE
  TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- ---------------------------------------------------------------------------
-- 2. audit_log: PHI-access flag (HIPAA §164.312(b) reporting)
-- ---------------------------------------------------------------------------
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS phi_accessed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- The live FK was created without ON DELETE SET NULL, so deleting any user
-- who had ever been audited failed (including /api/auth/delete-account).
-- Audit rows are retained; only the actor reference is cleared.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_actor_id_fkey
  FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
