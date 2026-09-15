CREATE TABLE IF NOT EXISTS order_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES users(id),
  kind varchar(30) NOT NULL,
  work_date timestamptz NOT NULL,
  title varchar(240) NOT NULL,
  description text,
  quantity_thousandths integer,
  unit varchar(30),
  unit_rate_ore bigint,
  amount_ore bigint NOT NULL DEFAULT 0,
  file_name varchar(300),
  metadata jsonb,
  billing_status billing_status NOT NULL DEFAULT 'UNBILLED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_entries_org_order_idx ON order_entries(organization_id, order_id, work_date);
