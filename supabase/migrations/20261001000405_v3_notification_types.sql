-- notification_type is an enum; the v3 admin and compliance flows insert
-- in-app notifications with these new types (suspend / reinstate, malpractice
-- verified, listing review outcomes). Without them the inserts fail and the
-- provider never sees the notification.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_suspended';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'verification_reinstated';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'insurance_verified';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_publish';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_request_changes';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'listing_pause';
