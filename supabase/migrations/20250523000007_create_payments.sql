-- 00007_create_payments.sql
-- Create payments, platform_fees tables, add FK to timesheets, invoice sequence

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  timesheet_id UUID REFERENCES timesheets(id) ON DELETE SET NULL,
  payer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  payee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status payment_status NOT NULL DEFAULT 'pending',
  -- Amounts
  gross_amount NUMERIC(12,2) NOT NULL,
  platform_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  stripe_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  stripe_charge_id TEXT,
  -- Escrow
  escrowed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  -- Invoice
  invoice_number TEXT UNIQUE,
  invoice_url TEXT,
  -- Metadata
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_payments_contract ON payments(contract_id);
CREATE INDEX idx_payments_payer ON payments(payer_id);
CREATE INDEX idx_payments_payee ON payments(payee_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_stripe_pi ON payments(stripe_payment_intent_id);

-- platform_fees table
CREATE TABLE platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  stripe_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_revenue NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_fees_payment ON platform_fees(payment_id);

-- Add FK from timesheets.payment_id to payments
ALTER TABLE timesheets
  ADD CONSTRAINT fk_timesheets_payment
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;

-- Invoice number sequence and trigger
CREATE SEQUENCE invoice_number_seq START WITH 10001;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL THEN
    NEW.invoice_number := 'SAN-INV-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 8, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_invoice_number
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();
