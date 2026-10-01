-- 20261001000400_provider_status_insurance_pending_suspended.sql
-- Provider onboarding v3 lifecycle statuses.
--   insurance_pending: approved, but malpractice coverage is required for the
--     services they selected and hasn't been reviewed yet (30-day grace
--     period, see insurance_due_at). They ARE live (can_go_live) but
--     requires_malpractice listings can't publish.
--   suspended: admin took them offline. NOT live.
-- Own migration: a new enum value can't be used in the transaction that adds
-- it (20261001000402+ reference these). ADD VALUE IF NOT EXISTS is a no-op on
-- re-run and takes no table lock.
ALTER TYPE provider_verification_status ADD VALUE IF NOT EXISTS 'insurance_pending' AFTER 'approved';
ALTER TYPE provider_verification_status ADD VALUE IF NOT EXISTS 'suspended' AFTER 'insurance_pending';
