CREATE INDEX generation_attempts_started_idx ON public.generation_attempts(started_at DESC);
CREATE INDEX generation_attempts_status_started_idx ON public.generation_attempts(status, started_at DESC);

-- Aggregate on the server so the admin never downloads every raw trace to count failures.
CREATE OR REPLACE FUNCTION public.generation_attempt_metrics(
  p_since TIMESTAMPTZ,
  p_status TEXT DEFAULT NULL,
  p_function_name TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS MATERIALIZED (
    SELECT status, stage, updated_at, duration_ms
    FROM public.generation_attempts
    WHERE started_at >= p_since
      AND (p_status IS NULL OR status = p_status)
      AND (p_function_name IS NULL OR function_name = p_function_name)
      AND (p_user_id IS NULL OR user_id = p_user_id)
      AND (p_request_id IS NULL OR request_id = p_request_id)
  ), stages AS (
    SELECT stage, count(*) AS failures
    FROM filtered
    WHERE status IN ('failed', 'timed_out')
    GROUP BY stage
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'fallbacks', count(*) FILTER (WHERE status = 'succeeded_with_fallback'),
    'failures', count(*) FILTER (WHERE status IN ('failed', 'timed_out')),
    'rejected', count(*) FILTER (WHERE status = 'rejected'),
    'running', count(*) FILTER (WHERE status = 'running'),
    'stale', count(*) FILTER (WHERE status = 'running' AND updated_at < now() - interval '5 minutes'),
    'avg_duration_ms', round(avg(duration_ms) FILTER (WHERE status IN ('succeeded', 'succeeded_with_fallback', 'failed', 'timed_out'))),
    'p95_duration_ms', percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) FILTER (WHERE status IN ('succeeded', 'succeeded_with_fallback', 'failed', 'timed_out')),
    'stage_failures', COALESCE((SELECT jsonb_object_agg(stage, failures) FROM stages), '{}'::jsonb)
  ) FROM filtered;
$$;

REVOKE ALL ON FUNCTION public.generation_attempt_metrics(TIMESTAMPTZ, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generation_attempt_metrics(TIMESTAMPTZ, TEXT, TEXT, UUID, UUID) TO authenticated, service_role;
COMMENT ON FUNCTION public.generation_attempt_metrics(TIMESTAMPTZ, TEXT, TEXT, UUID, UUID) IS
  'Admin metrics respect generation_attempts RLS. Counts include queue parent and child attempts; rejections are separate from operational failures.';
