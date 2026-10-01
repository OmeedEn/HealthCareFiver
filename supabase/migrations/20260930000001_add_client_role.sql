-- Add a real consumer/patient role. Consumers previously signed up as
-- 'contractor' and were funneled into the professional verification queue
-- and paywall.
--
-- Kept in its own migration: a newly added enum value cannot be referenced in
-- the same transaction that adds it (client_profiles + handle_new_user, which
-- use 'client', live in 20260930000005).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client';
