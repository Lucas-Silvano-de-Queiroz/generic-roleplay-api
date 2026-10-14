CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(24) NOT NULL CHECK (kind IN ('system-cover', 'collection-cover', 'record-image')),
  system_id uuid REFERENCES rpg_systems(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES rpg_collections(id) ON DELETE CASCADE,
  record_id uuid REFERENCES rpg_records(id) ON DELETE CASCADE,
  expected_cover_media_id uuid,
  bucket text NOT NULL,
  file_name varchar(255) NOT NULL CHECK (length(file_name) BETWEEN 1 AND 255),
  declared_content_type varchar(32) NOT NULL CHECK (declared_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  declared_size_bytes integer NOT NULL CHECK (declared_size_bytes BETWEEN 1 AND 10485760),
  checksum_sha256 varchar(44) NOT NULL,
  alt varchar(500) NOT NULL DEFAULT '',
  state varchar(16) NOT NULL CHECK (state IN ('pending', 'processing', 'ready')),
  temporary_key text NOT NULL,
  upload_expires_at timestamptz NOT NULL,
  complete_before timestamptz NOT NULL,
  attempt_id uuid,
  process_token uuid,
  lease_until timestamptz,
  final_key text,
  output_size_bytes integer,
  width integer,
  height integer,
  output_checksum_sha256 varchar(44),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_assets_destination_check CHECK (
    (kind = 'system-cover' AND system_id IS NOT NULL AND collection_id IS NULL AND record_id IS NULL) OR
    (kind = 'collection-cover' AND system_id IS NULL AND collection_id IS NOT NULL AND record_id IS NULL) OR
    (kind = 'record-image' AND system_id IS NULL AND collection_id IS NULL AND record_id IS NOT NULL)
  ),
  CONSTRAINT media_assets_ready_metadata_check CHECK (
    state <> 'ready' OR (final_key IS NOT NULL AND output_size_bytes BETWEEN 1 AND 10485760 AND width > 0 AND height > 0 AND published_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS media_assets_user_state_idx ON media_assets(user_id, state);
CREATE INDEX IF NOT EXISTS media_assets_record_published_idx ON media_assets(record_id, published_at, id) WHERE state = 'ready';
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_system_cover_unique ON media_assets(system_id) WHERE kind = 'system-cover' AND state = 'ready';
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_collection_cover_unique ON media_assets(collection_id) WHERE kind = 'collection-cover' AND state = 'ready';

CREATE TABLE IF NOT EXISTS media_processing_attempts (
  attempt_id uuid PRIMARY KEY,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  lease_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_attempts_media_id_idx ON media_processing_attempts(media_id);

CREATE TABLE IF NOT EXISTS media_cleanup_outbox (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  object_key text NOT NULL,
  not_before timestamptz NOT NULL,
  lease_until timestamptz,
  lease_token uuid,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_failure_code varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bucket, object_key)
);
CREATE INDEX IF NOT EXISTS media_cleanup_due_idx ON media_cleanup_outbox(next_attempt_at, not_before);

CREATE TABLE IF NOT EXISTS media_rate_limits (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope varchar(24) NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  CONSTRAINT media_rate_limits_user_scope_unique UNIQUE(user_id, scope)
);

CREATE OR REPLACE FUNCTION queue_media_asset_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cleanup_after timestamptz;
  old_attempt record;
BEGIN
  cleanup_after := CASE WHEN OLD.state = 'ready' THEN now() ELSE GREATEST(COALESCE(OLD.lease_until, now()) + interval '150 seconds', now()) END;
  INSERT INTO media_cleanup_outbox(bucket, object_key, not_before)
  VALUES (OLD.bucket, OLD.temporary_key, GREATEST(OLD.upload_expires_at + interval '120 seconds', now()))
  ON CONFLICT(bucket, object_key) DO UPDATE SET not_before = LEAST(media_cleanup_outbox.not_before, EXCLUDED.not_before);
  IF OLD.final_key IS NOT NULL THEN
    INSERT INTO media_cleanup_outbox(bucket, object_key, not_before)
    VALUES (OLD.bucket, OLD.final_key, cleanup_after)
    ON CONFLICT(bucket, object_key) DO UPDATE SET not_before = LEAST(media_cleanup_outbox.not_before, EXCLUDED.not_before);
  END IF;
  FOR old_attempt IN SELECT object_key, lease_until FROM media_processing_attempts WHERE media_id = OLD.id LOOP
    INSERT INTO media_cleanup_outbox(bucket, object_key, not_before)
    VALUES (OLD.bucket, old_attempt.object_key,
      CASE WHEN OLD.state = 'ready' AND old_attempt.object_key = OLD.final_key THEN now()
      ELSE GREATEST(old_attempt.lease_until + interval '150 seconds', now()) END)
    ON CONFLICT(bucket, object_key) DO UPDATE SET not_before = LEAST(media_cleanup_outbox.not_before, EXCLUDED.not_before);
  END LOOP;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS media_asset_cleanup_before_delete ON media_assets;
CREATE TRIGGER media_asset_cleanup_before_delete BEFORE DELETE ON media_assets
FOR EACH ROW EXECUTE FUNCTION queue_media_asset_cleanup();
