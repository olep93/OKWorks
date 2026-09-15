CREATE TABLE IF NOT EXISTS invoice_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  recipient varchar(320) NOT NULL,
  subject varchar(300) NOT NULL,
  message text NOT NULL,
  provider varchar(40) NOT NULL DEFAULT 'RESEND',
  provider_message_id varchar(200),
  status varchar(24) NOT NULL DEFAULT 'PENDING',
  error_message text,
  sent_by uuid REFERENCES users(id),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_deliveries_invoice_idx ON invoice_deliveries(organization_id, invoice_id, created_at);
