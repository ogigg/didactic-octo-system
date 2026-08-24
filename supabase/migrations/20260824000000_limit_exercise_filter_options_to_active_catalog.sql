CREATE OR REPLACE FUNCTION get_localized_exercise_filter_options(
  p_language TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH active_options AS (
    SELECT DISTINCT 'muscle'::TEXT AS label_type, muscle AS label_key
    FROM exercises e
    CROSS JOIN LATERAL unnest(e.primary_muscles) AS muscle
    WHERE e.catalog_status = 'active'
      AND muscle IS NOT NULL
      AND btrim(muscle) <> ''

    UNION

    SELECT DISTINCT 'equipment'::TEXT AS label_type, equipment_item AS label_key
    FROM exercises e
    CROSS JOIN LATERAL unnest(e.equipment) AS equipment_item
    WHERE e.catalog_status = 'active'
      AND equipment_item IS NOT NULL
      AND btrim(equipment_item) <> ''
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'label_type', active_options.label_type,
        'label_key', active_options.label_key,
        'display_name', COALESCE(req.display_name, en.display_name, active_options.label_key)
      )
      ORDER BY active_options.label_type, COALESCE(req.display_name, en.display_name, active_options.label_key)
    ),
    '[]'::jsonb
  )
  FROM active_options
  LEFT JOIN catalog_label_translations req
    ON req.label_type = active_options.label_type
   AND req.label_key = active_options.label_key
   AND req.language_code = COALESCE(NULLIF(p_language, ''), 'en')
  LEFT JOIN catalog_label_translations en
    ON en.label_type = active_options.label_type
   AND en.label_key = active_options.label_key
   AND en.language_code = 'en';
$$;
