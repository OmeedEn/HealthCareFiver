-- The facility profile form collects a contact title, but the column was never
-- created, so every facility profile save failed. Additive only.
ALTER TABLE facility_profiles ADD COLUMN IF NOT EXISTS contact_title TEXT;
