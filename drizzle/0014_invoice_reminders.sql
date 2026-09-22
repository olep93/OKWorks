ALTER TABLE invoice_deliveries
  ADD COLUMN IF NOT EXISTS delivery_type varchar(24) NOT NULL DEFAULT 'INVOICE';

CREATE INDEX IF NOT EXISTS invoice_deliveries_type_idx
  ON invoice_deliveries(organization_id, invoice_id, delivery_type, created_at);
