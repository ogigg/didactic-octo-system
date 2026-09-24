-- Settings edits replace baselines in one transaction, preserving them on error.
CREATE OR REPLACE FUNCTION public.save_strength_baselines(p_baselines jsonb, p_expected_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'Account changed before saving' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_baselines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_baselines) > 7 THEN
    RAISE EXCEPTION 'Invalid baselines' USING ERRCODE='22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_baselines) LOOP
    IF item->>'exercise_key' IS NULL OR item->>'exercise_key' NOT IN ('pushups','pullups','db_bench','db_row','bb_bench','bb_squat','deadlift')
      OR item->>'reps' IS NULL OR (item->>'reps')::numeric NOT BETWEEN 0 AND 999
      OR (item->>'reps')::numeric <> trunc((item->>'reps')::numeric)
      OR (item->>'load_kg')::numeric < 0 THEN
      RAISE EXCEPTION 'Invalid baseline values' USING ERRCODE='22023';
    END IF;
    IF item->>'exercise_key' IN ('pushups','pullups') THEN
      IF item->>'load_kg' IS NOT NULL THEN RAISE EXCEPTION 'Bodyweight load must be null' USING ERRCODE='22023'; END IF;
    ELSIF item->>'load_kg' IS NULL OR (item->>'reps')::int < 1 THEN
      RAISE EXCEPTION 'Weight and repetitions required' USING ERRCODE='22023';
    END IF;
  END LOOP;
  PERFORM 1 FROM profiles WHERE id=auth.uid() FOR UPDATE;
  DELETE FROM strength_baselines WHERE user_id=auth.uid();
  INSERT INTO strength_baselines(user_id,exercise_key,load_kg,reps)
  SELECT auth.uid(), value->>'exercise_key', (value->>'load_kg')::numeric, (value->>'reps')::integer
  FROM jsonb_array_elements(p_baselines);
END;
$$;
REVOKE ALL ON FUNCTION public.save_strength_baselines(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_strength_baselines(jsonb,uuid) TO authenticated;
