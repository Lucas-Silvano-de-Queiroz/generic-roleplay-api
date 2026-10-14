-- Additive rollout after users exists; apply before deploying RPG endpoints.
-- Standalone SQL, following the existing migration convention (no Drizzle journal).
BEGIN;
CREATE TABLE rpg_systems (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name varchar(100) NOT NULL,
 description varchar(5000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rpg_systems_name_check CHECK (length(btrim(name)) > 0)
);
CREATE INDEX rpg_systems_user_id_idx ON rpg_systems(user_id);
CREATE TABLE rpg_collections (
 id uuid PRIMARY KEY,
 system_id uuid NOT NULL REFERENCES rpg_systems(id) ON DELETE CASCADE,
 name varchar(100) NOT NULL,
 identifier varchar(64) NOT NULL,
 description varchar(5000),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rpg_collections_system_identifier_unique UNIQUE (system_id, identifier),
 CONSTRAINT rpg_collections_identifier_check CHECK (identifier ~ '^[a-z][a-z0-9_-]*$'),
 CONSTRAINT rpg_collections_name_check CHECK (length(btrim(name)) > 0)
);
CREATE INDEX rpg_collections_system_id_idx ON rpg_collections(system_id);
CREATE TABLE rpg_templates (
 id uuid PRIMARY KEY,
 collection_id uuid NOT NULL REFERENCES rpg_collections(id) ON DELETE CASCADE,
 name varchar(100) NOT NULL,
 identifier varchar(64) NOT NULL,
 description varchar(5000),
 category varchar(64),
 fields jsonb NOT NULL DEFAULT '[]'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rpg_templates_collection_identifier_unique UNIQUE (collection_id, identifier),
 CONSTRAINT rpg_templates_identifier_check CHECK (identifier ~ '^[a-z][a-z0-9_-]*$'),
 CONSTRAINT rpg_templates_name_check CHECK (length(btrim(name)) > 0),
 CONSTRAINT rpg_templates_fields_check CHECK (CASE WHEN jsonb_typeof(fields) = 'array' THEN jsonb_array_length(fields) <= 100 ELSE false END)
);
CREATE INDEX rpg_templates_collection_id_idx ON rpg_templates(collection_id);
COMMIT;
