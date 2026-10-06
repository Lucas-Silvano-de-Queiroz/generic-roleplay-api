-- Apply after 20261001_security_state.sql on an existing installation.
-- Access JWT validation no longer depends on database sessions.
-- Preserve only the currently valid refresh token hashes, then remove sessions.
BEGIN;
CREATE TABLE refresh_tokens (
 token_hash varchar(64) PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);
INSERT INTO refresh_tokens (token_hash, user_id, expires_at)
 SELECT token_hash, user_id, expires_at FROM sessions
 WHERE NOT revoked AND expires_at > now();
DROP TABLE sessions;
COMMIT;
