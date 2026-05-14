-- -----------------------------------------------------------------------------
-- Migration: add_exercise_translations
-- Separates stable exercise identity from localized catalog display text.
-- -----------------------------------------------------------------------------

CREATE TABLE exercise_translations (
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  name TEXT NOT NULL,
  instructions TEXT,
  source TEXT NOT NULL DEFAULT 'curated',
  source_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (exercise_id, language_code),
  CONSTRAINT exercise_translations_language_not_empty CHECK (char_length(language_code) > 0),
  CONSTRAINT exercise_translations_name_not_empty CHECK (char_length(name) > 0)
);

COMMENT ON TABLE exercise_translations IS
  'Localized display text for exercises. exercises.id remains the stable identity.';

CREATE TABLE catalog_label_translations (
  label_type TEXT NOT NULL,
  label_key TEXT NOT NULL,
  language_code TEXT NOT NULL,
  display_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'curated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (label_type, label_key, language_code),
  CONSTRAINT catalog_label_type_valid CHECK (label_type IN ('muscle', 'equipment', 'difficulty')),
  CONSTRAINT catalog_label_key_not_empty CHECK (char_length(label_key) > 0),
  CONSTRAINT catalog_label_display_name_not_empty CHECK (char_length(display_name) > 0)
);

COMMENT ON TABLE catalog_label_translations IS
  'Localized display names for canonical catalog labels used by filtering and summaries.';

CREATE INDEX idx_exercise_translations_language_name
  ON exercise_translations(language_code, name);

CREATE INDEX idx_catalog_label_translations_language
  ON catalog_label_translations(language_code, label_type);

CREATE TRIGGER exercise_translations_updated_at
  BEFORE UPDATE ON exercise_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER catalog_label_translations_updated_at
  BEFORE UPDATE ON catalog_label_translations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE exercise_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_label_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_translations_select_authenticated ON exercise_translations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY exercise_translations_modify_service_role ON exercise_translations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY catalog_label_translations_select_authenticated ON catalog_label_translations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY catalog_label_translations_modify_service_role ON catalog_label_translations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

INSERT INTO exercise_translations (exercise_id, language_code, name, instructions, source)
SELECT id, 'en', name, instructions, 'canonical'
FROM exercises
ON CONFLICT (exercise_id, language_code) DO UPDATE
SET
  name = EXCLUDED.name,
  instructions = EXCLUDED.instructions,
  source = EXCLUDED.source;

INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name, source)
SELECT DISTINCT 'muscle', muscle, 'en', muscle, 'canonical'
FROM exercises
CROSS JOIN LATERAL unnest(primary_muscles || COALESCE(secondary_muscles, ARRAY[]::TEXT[])) AS muscle
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET display_name = EXCLUDED.display_name, source = EXCLUDED.source;

INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name, source)
SELECT DISTINCT 'equipment', equipment_item, 'en', equipment_item, 'canonical'
FROM exercises
CROSS JOIN LATERAL unnest(equipment) AS equipment_item
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET display_name = EXCLUDED.display_name, source = EXCLUDED.source;

INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name, source)
SELECT DISTINCT 'difficulty', difficulty_level, 'en', difficulty_level, 'canonical'
FROM exercises
WHERE difficulty_level IS NOT NULL
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET display_name = EXCLUDED.display_name, source = EXCLUDED.source;

INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name, source)
VALUES
  ('muscle', 'Anterior deltoid', 'pl', 'Przedni akton barkow', 'curated'),
  ('muscle', 'Biceps brachii', 'pl', 'Biceps', 'curated'),
  ('muscle', 'Brachialis', 'pl', 'Ramienny', 'curated'),
  ('muscle', 'Erector spinae', 'pl', 'Prostowniki grzbietu', 'curated'),
  ('muscle', 'Gastrocnemius', 'pl', 'Lydki', 'curated'),
  ('muscle', 'Gluteus maximus', 'pl', 'Posladki', 'curated'),
  ('muscle', 'Hamstrings', 'pl', 'Dwuglowe uda', 'curated'),
  ('muscle', 'Lateral deltoid', 'pl', 'Boczny akton barkow', 'curated'),
  ('muscle', 'Latissimus dorsi', 'pl', 'Najszerszy grzbietu', 'curated'),
  ('muscle', 'Pectoralis major', 'pl', 'Klatka piersiowa', 'curated'),
  ('muscle', 'Posterior deltoid', 'pl', 'Tylny akton barkow', 'curated'),
  ('muscle', 'Quadriceps', 'pl', 'Czworoglowe uda', 'curated'),
  ('muscle', 'Rectus abdominis', 'pl', 'Miesnie brzucha', 'curated'),
  ('muscle', 'Rhomboids', 'pl', 'Rownolegloboczne', 'curated'),
  ('muscle', 'Soleus', 'pl', 'Miesien plaszczkowaty', 'curated'),
  ('muscle', 'Triceps brachii', 'pl', 'Triceps', 'curated'),
  ('equipment', 'Barbell', 'pl', 'Sztanga', 'curated'),
  ('equipment', 'Bench', 'pl', 'Lawka', 'curated'),
  ('equipment', 'Body weight', 'pl', 'Masa ciala', 'curated'),
  ('equipment', 'bodyweight', 'pl', 'Masa ciala', 'curated'),
  ('equipment', 'Cable machine', 'pl', 'Wyciag', 'curated'),
  ('equipment', 'Calf raise machine', 'pl', 'Maszyna do wspiec', 'curated'),
  ('equipment', 'Dip bars', 'pl', 'Porecze', 'curated'),
  ('equipment', 'Dumbbell', 'pl', 'Hantel', 'curated'),
  ('equipment', 'Dumbbells', 'pl', 'Hantle', 'curated'),
  ('equipment', 'Incline Bench', 'pl', 'Lawka skosna', 'curated'),
  ('equipment', 'Leg curl machine', 'pl', 'Maszyna do uginania nog', 'curated'),
  ('equipment', 'Leg extension machine', 'pl', 'Maszyna do prostowania nog', 'curated'),
  ('equipment', 'Leg press machine', 'pl', 'Suwnica', 'curated'),
  ('equipment', 'Pull-up bar', 'pl', 'Drazek', 'curated'),
  ('equipment', 'Squat rack', 'pl', 'Stojak do przysiadow', 'curated'),
  ('difficulty', 'beginner', 'pl', 'Poczatkujacy', 'curated'),
  ('difficulty', 'intermediate', 'pl', 'Sredniozaawansowany', 'curated'),
  ('difficulty', 'advanced', 'pl', 'Zaawansowany', 'curated')
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET display_name = EXCLUDED.display_name, source = EXCLUDED.source;

CREATE OR REPLACE FUNCTION get_localized_catalog_labels(
  p_language TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label_type', base.label_type,
        'label_key', base.label_key,
        'display_name', COALESCE(req.display_name, en.display_name, base.label_key)
      )
      ORDER BY base.label_type, COALESCE(req.display_name, en.display_name, base.label_key)
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT label_type, label_key
    FROM catalog_label_translations
  ) base
  LEFT JOIN catalog_label_translations req
    ON req.label_type = base.label_type
   AND req.label_key = base.label_key
   AND req.language_code = COALESCE(NULLIF(p_language, ''), 'en')
  LEFT JOIN catalog_label_translations en
    ON en.label_type = base.label_type
   AND en.label_key = base.label_key
   AND en.language_code = 'en';
$$;

CREATE OR REPLACE FUNCTION localized_label_array(
  p_label_type TEXT,
  p_label_keys TEXT[],
  p_language TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    jsonb_agg(COALESCE(req.display_name, en.display_name, labels.label_key) ORDER BY labels.ord),
    '[]'::jsonb
  )
  FROM unnest(COALESCE(p_label_keys, ARRAY[]::TEXT[])) WITH ORDINALITY AS labels(label_key, ord)
  LEFT JOIN catalog_label_translations req
    ON req.label_type = p_label_type
   AND req.label_key = labels.label_key
   AND req.language_code = COALESCE(NULLIF(p_language, ''), 'en')
  LEFT JOIN catalog_label_translations en
    ON en.label_type = p_label_type
   AND en.label_key = labels.label_key
   AND en.language_code = 'en';
$$;

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
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'name', COALESCE(req.name, en.name, e.name),
        'external_id', e.external_id,
        'exercise_type', e.exercise_type,
        'primary_muscles', e.primary_muscles,
        'primary_muscle_labels', localized_label_array('muscle', e.primary_muscles, p_language),
        'secondary_muscles', e.secondary_muscles,
        'secondary_muscle_labels', localized_label_array('muscle', e.secondary_muscles, p_language),
        'equipment', e.equipment,
        'equipment_labels', localized_label_array('equipment', e.equipment, p_language),
        'difficulty_level', e.difficulty_level,
        'difficulty_label', CASE
          WHEN e.difficulty_level IS NULL THEN NULL
          ELSE (
            SELECT COALESCE(req_label.display_name, en_label.display_name, e.difficulty_level)
            FROM (SELECT e.difficulty_level AS label_key) dl
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
        'instructions', COALESCE(req.instructions, en.instructions, e.instructions),
        'image_url', e.image_url,
        'video_url', e.video_url
      )
      ORDER BY COALESCE(req.name, en.name, e.name)
    ),
    '[]'::jsonb
  )
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
    AND (
      p_search IS NULL
      OR COALESCE(req.name, en.name, e.name) ILIKE ('%' || p_search || '%')
      OR e.name ILIKE ('%' || p_search || '%')
      OR en.name ILIKE ('%' || p_search || '%')
    );
$$;

CREATE OR REPLACE FUNCTION get_localized_exercise(
  p_exercise_id UUID,
  p_language TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (get_localized_exercises(p_language, NULL, NULL, NULL, ARRAY[p_exercise_id])->0),
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION get_workout_history_page(
  p_limit       INT,
  p_cursor      TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result  JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_agg(row_data ORDER BY row_data->>'completed_at' DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id',             ws.id,
      'name',           ws.name,
      'started_at',     ws.started_at,
      'completed_at',   ws.completed_at,
      'created_at',     ws.created_at,
      'exercise_count', COALESCE(ex_summary.exercise_count, 0),
      'total_sets',     COALESCE(ex_summary.total_sets, 0),
      'total_volume_kg',COALESCE(ex_summary.total_volume_kg, 0),
      'exercise_ids',   COALESCE(ex_summary.exercise_ids, '[]'::jsonb),
      'exercise_names', COALESCE(ex_summary.exercise_names, '[]'::jsonb)
    ) AS row_data
    FROM workout_sessions ws
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT se.id)::int                     AS exercise_count,
        COUNT(sl.id)::int                              AS total_sets,
        COALESCE(
          SUM(sl.actual_load_kg * sl.actual_reps)
          FILTER (WHERE sl.completed = true AND sl.actual_load_kg IS NOT NULL AND sl.actual_reps IS NOT NULL),
          0
        )::numeric(10,2)                               AS total_volume_kg,
        (
          SELECT jsonb_agg(se2.exercise_id ORDER BY se2.order_index)
          FROM session_exercises se2
          WHERE se2.workout_session_id = ws.id
        )                                              AS exercise_ids,
        (
          SELECT jsonb_agg(e2.name ORDER BY se2.order_index)
          FROM session_exercises se2
          JOIN exercises e2 ON e2.id = se2.exercise_id
          WHERE se2.workout_session_id = ws.id
        )                                              AS exercise_names
      FROM session_exercises se
      JOIN session_sets ss  ON ss.session_exercise_id = se.id
      JOIN set_logs sl      ON sl.session_set_id = ss.id
      WHERE se.workout_session_id = ws.id
    ) ex_summary ON true
    WHERE ws.user_id  = v_user_id
      AND ws.status   = 'completed'
      AND (p_cursor IS NULL OR ws.completed_at < p_cursor)
    ORDER BY ws.completed_at DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION get_workout_history_for_day_range(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result  JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_agg(row_data ORDER BY row_data->>'completed_at' DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id',             ws.id,
      'name',           ws.name,
      'started_at',     ws.started_at,
      'completed_at',   ws.completed_at,
      'created_at',     ws.created_at,
      'exercise_count', COALESCE(ex_summary.exercise_count, 0),
      'total_sets',     COALESCE(ex_summary.total_sets, 0),
      'total_volume_kg',COALESCE(ex_summary.total_volume_kg, 0),
      'exercise_ids',   COALESCE(ex_summary.exercise_ids, '[]'::jsonb),
      'exercise_names', COALESCE(ex_summary.exercise_names, '[]'::jsonb)
    ) AS row_data
    FROM workout_sessions ws
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT se.id)::int                     AS exercise_count,
        COUNT(sl.id)::int                              AS total_sets,
        COALESCE(
          SUM(sl.actual_load_kg * sl.actual_reps)
          FILTER (WHERE sl.completed = true AND sl.actual_load_kg IS NOT NULL AND sl.actual_reps IS NOT NULL),
          0
        )::numeric(10,2)                               AS total_volume_kg,
        (
          SELECT jsonb_agg(se2.exercise_id ORDER BY se2.order_index)
          FROM session_exercises se2
          WHERE se2.workout_session_id = ws.id
        )                                              AS exercise_ids,
        (
          SELECT jsonb_agg(e2.name ORDER BY se2.order_index)
          FROM session_exercises se2
          JOIN exercises e2 ON e2.id = se2.exercise_id
          WHERE se2.workout_session_id = ws.id
        )                                              AS exercise_names
      FROM session_exercises se
      JOIN session_sets ss  ON ss.session_exercise_id = se.id
      JOIN set_logs sl      ON sl.session_set_id = ss.id
      WHERE se.workout_session_id = ws.id
    ) ex_summary ON true
    WHERE ws.user_id  = v_user_id
      AND ws.status   = 'completed'
      AND ws.completed_at IS NOT NULL
      AND ws.completed_at >= p_start
      AND ws.completed_at < p_end
    ORDER BY ws.completed_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
