-- 20260606000001_create_webhook_events.sql
-- Stripe webhook idempotency: record processed event ids so Stripe retries are safe.

CREATE TABLE stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stripe_webhook_events_processed_at
  ON stripe_webhook_events (processed_at DESC);
