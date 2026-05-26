-- 20250525000001_add_subscription_status.sql
-- Add subscription tracking to profiles for paid contractor listings

-- Subscription status enum
CREATE TYPE subscription_status AS ENUM ('inactive', 'active', 'trialing', 'past_due', 'canceled');

-- Add subscription columns to profiles
ALTER TABLE profiles
  ADD COLUMN subscription_status subscription_status NOT NULL DEFAULT 'inactive',
  ADD COLUMN stripe_subscription_id TEXT,
  ADD COLUMN subscription_price_id TEXT,
  ADD COLUMN subscription_current_period_end TIMESTAMPTZ;

-- Index for filtering visible contractors
CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);
