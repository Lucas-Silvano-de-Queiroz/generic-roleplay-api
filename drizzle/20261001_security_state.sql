-- Additive rollout for an existing users table. Review and apply before deploying the API.
-- This standalone SQL is not registered in a Drizzle migration journal.
BEGIN;
CREATE TABLE sessions (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL,
 expires_at timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);
CREATE TABLE rate_limits (
 key varchar(64) PRIMARY KEY,
 count integer NOT NULL,
 reset_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_reset_at_idx ON rate_limits(reset_at);
COMMIT;
