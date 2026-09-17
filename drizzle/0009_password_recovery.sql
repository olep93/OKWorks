ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires_at timestamptz;
CREATE TABLE IF NOT EXISTS auth_mail_limits (
  scope_hash varchar(64) PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);
