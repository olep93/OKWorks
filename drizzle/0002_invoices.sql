DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('DRAFT', 'FINALIZED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED', 'VOID'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS invoice_sequences (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1001,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_order_id uuid NOT NULL REFERENCES orders(id), customer_id uuid NOT NULL REFERENCES customers(id),
  invoice_number integer, status invoice_status NOT NULL DEFAULT 'DRAFT', issue_date timestamptz, due_date timestamptz,
  currency varchar(3) NOT NULL DEFAULT 'NOK', subtotal_ore bigint NOT NULL DEFAULT 0, vat_amount_ore bigint NOT NULL DEFAULT 0,
  total_ore bigint NOT NULL DEFAULT 0, paid_amount_ore bigint NOT NULL DEFAULT 0, remaining_amount_ore bigint NOT NULL DEFAULT 0,
  kid varchar(32), organization_snapshot jsonb, customer_snapshot jsonb, bank_account_snapshot varchar(32),
  idempotency_key uuid NOT NULL, finalized_at timestamptz, sent_at timestamptz, paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number), UNIQUE (organization_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE, source_type varchar(40), source_id uuid,
  line_type varchar(40) NOT NULL, description text NOT NULL, quantity_thousandths integer NOT NULL,
  unit varchar(30) NOT NULL, unit_price_ore bigint NOT NULL, vat_basis_points integer NOT NULL,
  subtotal_ore bigint NOT NULL, vat_amount_ore bigint NOT NULL, total_ore bigint NOT NULL,
  sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_org_status_idx ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS invoice_lines_org_invoice_idx ON invoice_lines(organization_id, invoice_id, sort_order);
INSERT INTO invoice_sequences (organization_id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;
