CREATE UNIQUE INDEX IF NOT EXISTS invoice_lines_billed_source_unique
  ON invoice_lines(organization_id, source_type, source_id);

CREATE UNIQUE INDEX IF NOT EXISTS invoices_active_order_unique
  ON invoices(organization_id, source_order_id)
  WHERE status <> 'VOID';
