-- 20260930000003_verification_not_submitted_enum.sql
-- New providers start in `not_submitted` (nothing uploaded yet) rather than
-- `pending_review`. Added in its own migration because a new enum value
-- can't be referenced in the same transaction that adds it; the default and
-- backfill live in 20260930000004.
ALTER TYPE provider_verification_status ADD VALUE IF NOT EXISTS 'not_submitted' BEFORE 'pending_review';
