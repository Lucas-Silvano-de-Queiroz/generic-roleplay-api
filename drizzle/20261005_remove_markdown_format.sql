-- Apply before deploying the text/textarea-only contract on an existing database.
-- Preserve field order, metadata and all record values. Safe to run again.
BEGIN;
UPDATE rpg_templates AS template
SET fields = (
 SELECT jsonb_agg(
  CASE WHEN field->>'format' = 'markdown'
   THEN jsonb_set(field, '{format}', '"textarea"'::jsonb)
   ELSE field END
  ORDER BY position
 )
 FROM jsonb_array_elements(template.fields) WITH ORDINALITY AS fields(field, position)
), updated_at = now()
WHERE EXISTS (
 SELECT 1 FROM jsonb_array_elements(template.fields) AS fields(field)
 WHERE field->>'format' = 'markdown'
);
COMMIT;
