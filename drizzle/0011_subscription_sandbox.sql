CREATE TABLE IF NOT EXISTS subscription_checkout_attempts (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES users(id),
  terms_version text NOT NULL,
  customer_email text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  session_id text UNIQUE,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_checkout_org_idx ON subscription_checkout_attempts(organization_id, created_at DESC);
CREATE TABLE IF NOT EXISTS subscription_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
