ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_required boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_hash varchar(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS users_verification_token_idx ON users (verification_token_hash) WHERE verification_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_reset_token_idx ON users (reset_token_hash) WHERE reset_token_hash IS NOT NULL;
