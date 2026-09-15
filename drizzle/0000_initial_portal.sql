CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN CREATE TYPE organization_role AS ENUM ('OWNER', 'ADMIN', 'USER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('DRAFT', 'OPEN', 'IN_PROGRESS', 'READY_FOR_INVOICE', 'INVOICED', 'CLOSED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE billing_status AS ENUM ('UNBILLED', 'INVOICED', 'NON_BILLABLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name varchar(200) NOT NULL,
  organization_number varchar(20), email varchar(320), phone varchar(40), address text, postal_code varchar(16), city varchar(120),
  logo_storage_key text, invoice_email varchar(320), invoice_phone varchar(40), bank_account varchar(32),
  vat_registered boolean NOT NULL DEFAULT false, default_payment_terms_days integer NOT NULL DEFAULT 14,
  default_vat_basis_points integer NOT NULL DEFAULT 2500, default_hourly_rate_ore bigint,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_settings (
  organization_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  mileage_rate_ore bigint NOT NULL DEFAULT 500, diet_day_rate_ore bigint NOT NULL DEFAULT 0,
  diet_overnight_rate_ore bigint NOT NULL DEFAULT 0, hotel_markup_basis_points integer NOT NULL DEFAULT 0,
  expense_markup_basis_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(320) NOT NULL UNIQUE, name varchar(160) NOT NULL,
  password_hash text, setup_token_hash varchar(64), setup_expires_at timestamptz, email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role organization_role NOT NULL DEFAULT 'USER', active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash varchar(128) NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type varchar(16) NOT NULL DEFAULT 'COMPANY', name varchar(200) NOT NULL, organization_number varchar(20),
  email varchar(320), phone varchar(40), address text, postal_code varchar(16), city varchar(120), notes text,
  payment_terms_override integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number integer NOT NULL, customer_id uuid NOT NULL REFERENCES customers(id), status order_status NOT NULL DEFAULT 'DRAFT',
  title varchar(240) NOT NULL, description text, work_address text, assigned_user_id uuid REFERENCES users(id),
  ready_for_invoice_at timestamptz, closed_at timestamptz, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (organization_id, order_number)
);
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL, description text, unit varchar(30) NOT NULL, default_price_ore bigint NOT NULL,
  vat_basis_points integer NOT NULL, product_code varchar(80), category varchar(80), active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, product_code)
);
CREATE TABLE IF NOT EXISTS time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE, user_id uuid NOT NULL REFERENCES users(id),
  work_date timestamptz NOT NULL, minutes integer NOT NULL, rate_per_hour_ore bigint NOT NULL, description text,
  billing_status billing_status NOT NULL DEFAULT 'UNBILLED', invoice_line_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organization_members_user_idx ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS customers_org_name_idx ON customers(organization_id, name);
CREATE INDEX IF NOT EXISTS orders_org_status_idx ON orders(organization_id, status);

INSERT INTO organizations (id, name, email) VALUES ('00000000-0000-4000-8000-000000000001', 'OK Works', 'olep93@gmail.com') ON CONFLICT (id) DO NOTHING;
INSERT INTO users (id, email, name, setup_token_hash, setup_expires_at)
VALUES ('00000000-0000-4000-8000-000000000002', 'olep93@gmail.com', 'Ole Kristiansen', '6b5a35f16789c5bccdecc1d5580e21878d179c9370dfc22d22b424355bdee77e', now() + interval '30 days')
ON CONFLICT (email) DO NOTHING;
INSERT INTO organization_members (organization_id, user_id, role)
VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'OWNER') ON CONFLICT DO NOTHING;
INSERT INTO organization_settings (organization_id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;

DELETE FROM orders WHERE organization_id = '00000000-0000-4000-8000-000000000001';
DELETE FROM customers WHERE organization_id = '00000000-0000-4000-8000-000000000001';
