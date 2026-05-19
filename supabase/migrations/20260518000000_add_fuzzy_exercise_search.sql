-- -----------------------------------------------------------------------------
-- Migration: add_fuzzy_exercise_search
-- Makes localized exercise search typo-tolerant while keeping filtering server-side.
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

CREATE INDEX IF NOT EXISTS idx_exercises_name_trgm
  ON exercises USING gin (lower(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_exercise_translations_name_trgm
  ON exercise_translations USING gin (lower(name) gin_trgm_ops);

CREATE OR REPLACE FUNCTION get_localized_exercises(
  p_language TEXT DEFAULT 'en',
  p_search TEXT DEFAULT NULL,
  p_muscles TEXT[] DEFAULT NULL,
  p_equipment TEXT[] DEFAULT NULL,
  p_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH search_input AS (
    SELECT NULLIF(trim(p_search), '') AS query
  ),
  localized AS (
    SELECT
      e.id,
      e.name AS canonical_name,
      e.external_id,
      e.exercise_type,
      e.primary_muscles,
      e.secondary_muscles,
      e.equipment,
      e.difficulty_level,
      e.instructions AS canonical_instructions,
      e.image_url,
      e.video_url,
      COALESCE(req.name, en.name, e.name) AS localized_name,
      COALESCE(req.instructions, en.instructions, e.instructions) AS localized_instructions,
      en.name AS english_name
    FROM exercises e
    LEFT JOIN exercise_translations req
      ON req.exercise_id = e.id
     AND req.language_code = COALESCE(NULLIF(p_language, ''), 'en')
    LEFT JOIN exercise_translations en
      ON en.exercise_id = e.id
     AND en.language_code = 'en'
    WHERE (p_ids IS NULL OR e.id = ANY(p_ids))
      AND (p_muscles IS NULL OR e.primary_muscles && p_muscles)
      AND (p_equipment IS NULL OR e.equipment && p_equipment)
  ),
  ranked AS (
    SELECT
      l.*,
      lower(si.query) AS normalized_query,
      lower(l.localized_name) AS normalized_localized_name,
      lower(l.canonical_name) AS normalized_canonical_name,
      lower(COALESCE(l.english_name, '')) AS normalized_english_name
    FROM localized l
    CROSS JOIN search_input si
  ),
  matches AS (
    SELECT
      r.*,
      CASE
        WHEN r.normalized_query IS NULL THEN 0
        WHEN r.normalized_localized_name = r.normalized_query THEN 100
        WHEN r.normalized_canonical_name = r.normalized_query THEN 95
        WHEN r.normalized_english_name = r.normalized_query THEN 90
        WHEN r.normalized_localized_name LIKE (r.normalized_query || '%') THEN 80
        WHEN r.normalized_canonical_name LIKE (r.normalized_query || '%') THEN 76
        WHEN r.normalized_english_name LIKE (r.normalized_query || '%') THEN 72
        WHEN r.normalized_localized_name LIKE ('%' || r.normalized_query || '%') THEN 60
        WHEN r.normalized_canonical_name LIKE ('%' || r.normalized_query || '%') THEN 56
        WHEN r.normalized_english_name LIKE ('%' || r.normalized_query || '%') THEN 52
        ELSE GREATEST(
          similarity(r.normalized_localized_name, r.normalized_query),
          similarity(r.normalized_canonical_name, r.normalized_query),
          similarity(r.normalized_english_name, r.normalized_query),
          word_similarity(r.normalized_query, r.normalized_localized_name),
          word_similarity(r.normalized_query, r.normalized_canonical_name),
          word_similarity(r.normalized_query, r.normalized_english_name)
        ) * 40
      END AS search_rank
    FROM ranked r
    WHERE r.normalized_query IS NULL
      OR r.normalized_localized_name LIKE ('%' || r.normalized_query || '%')
      OR r.normalized_canonical_name LIKE ('%' || r.normalized_query || '%')
      OR r.normalized_english_name LIKE ('%' || r.normalized_query || '%')
      OR (
        char_length(r.normalized_query) >= 3
        AND GREATEST(
          similarity(r.normalized_localized_name, r.normalized_query),
          similarity(r.normalized_canonical_name, r.normalized_query),
          similarity(r.normalized_english_name, r.normalized_query),
          word_similarity(r.normalized_query, r.normalized_localized_name),
          word_similarity(r.normalized_query, r.normalized_canonical_name),
          word_similarity(r.normalized_query, r.normalized_english_name)
        ) >= 0.35
      )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.localized_name,
        'external_id', m.external_id,
        'exercise_type', m.exercise_type,
        'primary_muscles', m.primary_muscles,
        'primary_muscle_labels', localized_label_array('muscle', m.primary_muscles, p_language),
        'secondary_muscles', m.secondary_muscles,
        'secondary_muscle_labels', localized_label_array('muscle', m.secondary_muscles, p_language),
        'equipment', m.equipment,
        'equipment_labels', localized_label_array('equipment', m.equipment, p_language),
        'difficulty_level', m.difficulty_level,
        'difficulty_label', CASE
          WHEN m.difficulty_level IS NULL THEN NULL
          ELSE (
            SELECT COALESCE(req_label.display_name, en_label.display_name, m.difficulty_level)
            FROM (SELECT m.difficulty_level AS label_key) dl
            LEFT JOIN catalog_label_translations req_label
              ON req_label.label_type = 'difficulty'
             AND req_label.label_key = dl.label_key
             AND req_label.language_code = COALESCE(NULLIF(p_language, ''), 'en')
            LEFT JOIN catalog_label_translations en_label
              ON en_label.label_type = 'difficulty'
             AND en_label.label_key = dl.label_key
             AND en_label.language_code = 'en'
          )
        END,
        'instructions', m.localized_instructions,
        'image_url', m.image_url,
        'video_url', m.video_url
      )
      ORDER BY m.search_rank DESC, m.localized_name
    ),
    '[]'::jsonb
  )
  FROM matches m;
$$;
