-- Apply after rpg_content, before deploying Records or the updated template API.
BEGIN;
CREATE TABLE rpg_records (
 id uuid PRIMARY KEY,
 template_id uuid NOT NULL REFERENCES rpg_templates(id) ON DELETE CASCADE,
 values jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT rpg_records_values_check CHECK (jsonb_typeof(values) = 'object')
);
CREATE INDEX rpg_records_template_id_id_idx ON rpg_records(template_id, id);
COMMIT;
