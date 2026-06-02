-- -----------------------------------------------------------------------------
-- Migration: add_exercise_media_assets
-- Adds reviewed catalog-owned media for exercise illustrations.
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exercise-media',
  'exercise-media',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "exercise media authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'exercise-media');

CREATE POLICY "exercise media service writes"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'exercise-media')
WITH CHECK (bucket_id = 'exercise-media');

CREATE TABLE exercise_media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,

  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  purpose TEXT NOT NULL CHECK (purpose IN ('thumbnail', 'hero', 'step', 'animated', 'video')),
  source TEXT NOT NULL CHECK (source IN ('curated', 'imported', 'generated', 'placeholder')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'rejected')),

  storage_bucket TEXT NOT NULL DEFAULT 'exercise-media',
  storage_path TEXT NOT NULL,
  public_url TEXT,

  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  content_type TEXT,
  file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
  blurhash TEXT,

  alt_text TEXT,
  attribution TEXT,
  license TEXT,
  source_url TEXT,
  checksum_sha256 TEXT,

  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exercise_media_assets_path_unique UNIQUE (storage_bucket, storage_path)
);

COMMENT ON TABLE exercise_media_assets IS 'Reviewed catalog-owned exercise media served from Supabase Storage.';
COMMENT ON COLUMN exercise_media_assets.public_url IS 'Stable public URL for non-private exercise catalog assets.';

CREATE UNIQUE INDEX idx_exercise_media_one_active_thumbnail
  ON exercise_media_assets(exercise_id)
  WHERE kind = 'image' AND purpose = 'thumbnail' AND status = 'active';

CREATE UNIQUE INDEX idx_exercise_media_one_active_hero
  ON exercise_media_assets(exercise_id)
  WHERE kind = 'image' AND purpose = 'hero' AND status = 'active';

CREATE INDEX idx_exercise_media_exercise_active
  ON exercise_media_assets(exercise_id, status, purpose, sort_order);

CREATE TRIGGER exercise_media_assets_updated_at
  BEFORE UPDATE ON exercise_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE exercise_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_media_assets_select_authenticated
  ON exercise_media_assets
  FOR SELECT TO authenticated
  USING (status = 'active');

CREATE POLICY exercise_media_assets_modify_service_role
  ON exercise_media_assets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

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
      primary_image.public_url AS primary_image_url,
      primary_image.width AS primary_image_width,
      primary_image.height AS primary_image_height,
      primary_image.blurhash AS primary_image_blurhash,
      primary_image.alt_text AS primary_image_alt_text,
      primary_image.source AS primary_image_source,
      thumbnail_image.public_url AS thumbnail_image_url,
      thumbnail_image.width AS thumbnail_image_width,
      thumbnail_image.height AS thumbnail_image_height,
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
    LEFT JOIN LATERAL (
      SELECT ema.*
      FROM exercise_media_assets ema
      WHERE ema.exercise_id = e.id
        AND ema.kind = 'image'
        AND ema.status = 'active'
      ORDER BY
        CASE ema.purpose WHEN 'hero' THEN 0 WHEN 'thumbnail' THEN 1 ELSE 2 END,
        ema.sort_order,
        ema.created_at
      LIMIT 1
    ) primary_image ON true
    LEFT JOIN LATERAL (
      SELECT ema.*
      FROM exercise_media_assets ema
      WHERE ema.exercise_id = e.id
        AND ema.kind = 'image'
        AND ema.purpose = 'thumbnail'
        AND ema.status = 'active'
      ORDER BY ema.sort_order, ema.created_at
      LIMIT 1
    ) thumbnail_image ON true
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
        'image', CASE
          WHEN COALESCE(m.primary_image_url, m.image_url) IS NULL THEN NULL
          ELSE jsonb_build_object(
            'url', COALESCE(m.primary_image_url, m.image_url),
            'thumbnail_url', m.thumbnail_image_url,
            'width', m.primary_image_width,
            'height', m.primary_image_height,
            'thumbnail_width', m.thumbnail_image_width,
            'thumbnail_height', m.thumbnail_image_height,
            'alt_text', m.primary_image_alt_text,
            'blurhash', m.primary_image_blurhash,
            'source', m.primary_image_source
          )
        END,
        'image_url', COALESCE(m.primary_image_url, m.image_url),
        'video_url', m.video_url
      )
      ORDER BY m.search_rank DESC, m.localized_name
    ),
    '[]'::jsonb
  )
  FROM matches m;
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
