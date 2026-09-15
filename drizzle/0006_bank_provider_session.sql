ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS bank_id text;
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS device_id uuid;
ALTER TABLE bank_connections ADD COLUMN IF NOT EXISTS provider_session_encrypted text;
CREATE INDEX IF NOT EXISTS bank_connections_org_status_idx ON bank_connections(organization_id, status);
