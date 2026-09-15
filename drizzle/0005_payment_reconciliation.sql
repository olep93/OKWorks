CREATE TABLE IF NOT EXISTS bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider varchar(40) NOT NULL DEFAULT 'NEONOMICS', provider_account_id text, account_number_masked varchar(32),
  status varchar(24) NOT NULL DEFAULT 'DISCONNECTED', consent_expires_at timestamptz, last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES bank_connections(id) ON DELETE SET NULL, provider_transaction_id text NOT NULL,
  booked_at timestamptz NOT NULL, amount_ore bigint NOT NULL, currency varchar(3) NOT NULL DEFAULT 'NOK',
  kid varchar(32), reference text, raw_data jsonb, matched_invoice_id uuid REFERENCES invoices(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id, provider_transaction_id)
);
CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, bank_transaction_id uuid REFERENCES bank_transactions(id),
  amount_ore bigint NOT NULL, paid_at timestamptz NOT NULL, source varchar(24) NOT NULL DEFAULT 'MANUAL', note text,
  created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON invoice_payments(organization_id, invoice_id, paid_at);
CREATE INDEX IF NOT EXISTS bank_transactions_unmatched_idx ON bank_transactions(organization_id, matched_invoice_id);
