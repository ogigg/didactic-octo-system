-- Additional provider diagnostics for model calls.
-- All columns are nullable so rows written before this migration remain valid.

ALTER TABLE public.llm_generation_logs
  ADD COLUMN IF NOT EXISTS request_settings JSONB,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS finish_reason TEXT,
  ADD COLUMN IF NOT EXISTS reasoning_tokens INTEGER
    CHECK (reasoning_tokens IS NULL OR reasoning_tokens >= 0),
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC
    CHECK (cost_usd IS NULL OR cost_usd >= 0),
  ADD COLUMN IF NOT EXISTS failure_code TEXT;

CREATE INDEX IF NOT EXISTS llm_generation_logs_provider_created_idx
  ON public.llm_generation_logs(provider, created_at DESC)
  WHERE provider IS NOT NULL;

COMMENT ON COLUMN public.llm_generation_logs.request_settings IS
  'Effective model request settings, including routing, reasoning, response format, and token budget.';
COMMENT ON COLUMN public.llm_generation_logs.provider IS
  'Provider selected by OpenRouter for this model call, when returned.';
COMMENT ON COLUMN public.llm_generation_logs.finish_reason IS
  'Provider finish reason, for example stop, length, or content_filter.';
COMMENT ON COLUMN public.llm_generation_logs.reasoning_tokens IS
  'Provider-reported hidden reasoning token count, when available.';
COMMENT ON COLUMN public.llm_generation_logs.cost_usd IS
  'Provider-reported request cost in US dollars, when available.';
COMMENT ON COLUMN public.llm_generation_logs.failure_code IS
  'Stable application failure category used to explain fallback behavior.';

-- Recover provider response metadata where the old trace already retained it.
-- Request settings and failure codes stay null because older rows cannot prove
-- those values without guessing.
UPDATE public.llm_generation_logs
SET provider = NULLIF(raw_response->>'provider', '')
WHERE provider IS NULL
  AND NULLIF(raw_response->>'provider', '') IS NOT NULL;

UPDATE public.llm_generation_logs
SET finish_reason = NULLIF(raw_response #>> '{choices,0,finish_reason}', '')
WHERE finish_reason IS NULL
  AND NULLIF(raw_response #>> '{choices,0,finish_reason}', '') IS NOT NULL;

UPDATE public.llm_generation_logs
SET reasoning_tokens = CASE
  WHEN raw_response #>> '{usage,completion_tokens_details,reasoning_tokens}' ~ '^[0-9]+$'
  THEN (raw_response #>> '{usage,completion_tokens_details,reasoning_tokens}')::INTEGER
  ELSE NULL
END
WHERE reasoning_tokens IS NULL
  AND raw_response #>> '{usage,completion_tokens_details,reasoning_tokens}' ~ '^[0-9]+$';

UPDATE public.llm_generation_logs
SET prompt_tokens = CASE
  WHEN raw_response #>> '{usage,prompt_tokens}' ~ '^[0-9]+$'
  THEN (raw_response #>> '{usage,prompt_tokens}')::INTEGER
  ELSE NULL
END
WHERE prompt_tokens IS NULL
  AND raw_response #>> '{usage,prompt_tokens}' ~ '^[0-9]+$';

UPDATE public.llm_generation_logs
SET completion_tokens = CASE
  WHEN raw_response #>> '{usage,completion_tokens}' ~ '^[0-9]+$'
  THEN (raw_response #>> '{usage,completion_tokens}')::INTEGER
  ELSE NULL
END
WHERE completion_tokens IS NULL
  AND raw_response #>> '{usage,completion_tokens}' ~ '^[0-9]+$';

UPDATE public.llm_generation_logs
SET cost_usd = CASE
  WHEN raw_response #>> '{usage,cost}' ~ '^[0-9]+([.][0-9]+)?$'
  THEN (raw_response #>> '{usage,cost}')::NUMERIC
  ELSE NULL
END
WHERE cost_usd IS NULL
  AND raw_response #>> '{usage,cost}' ~ '^[0-9]+([.][0-9]+)?$';

-- Aggregate model health in the database. SECURITY INVOKER is deliberate:
-- llm_generation_logs and generation_attempts RLS remain the admin boundary.
CREATE OR REPLACE FUNCTION public.llm_generation_metrics(
  p_since TIMESTAMPTZ DEFAULT now() - interval '24 hours',
  p_status TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_function_name TEXT DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL,
  p_request_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH filtered AS MATERIALIZED (
    SELECT
      l.id,
      l.attempt_id,
      COALESCE(NULLIF(l.provider, ''), NULLIF(l.raw_response->>'provider', ''), 'unknown') AS provider,
      l.status,
      l.duration_ms,
      l.reasoning_tokens,
      l.completion_tokens,
      l.cost_usd
    FROM public.llm_generation_logs AS l
    WHERE l.created_at >= COALESCE(p_since, now() - interval '24 hours')
      AND (p_status IS NULL OR l.status = p_status)
      AND (p_provider IS NULL OR COALESCE(NULLIF(l.provider, ''), NULLIF(l.raw_response->>'provider', '')) = p_provider)
      AND (p_function_name IS NULL OR l.function_name = p_function_name)
      AND (p_failure_code IS NULL OR l.failure_code = p_failure_code)
      AND (p_request_id IS NULL OR l.request_id = p_request_id)
  ),
  providers AS (
    SELECT
      f.provider,
      count(*)::INTEGER AS calls,
      count(*) FILTER (WHERE f.status = 'success')::INTEGER AS valid_success,
      count(*) FILTER (WHERE f.status IN ('parse_error', 'api_error', 'timeout'))::INTEGER AS failures,
      round(avg(f.duration_ms) FILTER (WHERE f.duration_ms IS NOT NULL), 1) AS avg_duration_ms,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY f.duration_ms)
        FILTER (WHERE f.duration_ms IS NOT NULL))::NUMERIC, 1) AS p50_duration_ms,
      round((percentile_cont(0.95) WITHIN GROUP (ORDER BY f.duration_ms)
        FILTER (WHERE f.duration_ms IS NOT NULL))::NUMERIC, 1) AS p95_duration_ms,
      sum(f.reasoning_tokens)::INTEGER AS reasoning_tokens,
      sum(f.completion_tokens)::INTEGER AS completion_tokens,
      round(sum(f.cost_usd), 8) AS cost_usd
    FROM filtered AS f
    GROUP BY f.provider
  ),
  linked_attempts AS (
    SELECT DISTINCT f.attempt_id, a.status
    FROM filtered AS f
    JOIN public.generation_attempts AS a ON a.id = f.attempt_id
    WHERE f.attempt_id IS NOT NULL
  ),
  totals AS (
    SELECT
      count(*)::INTEGER AS calls,
      count(*) FILTER (WHERE f.status = 'success')::INTEGER AS valid_success,
      count(*) FILTER (WHERE f.status IN ('parse_error', 'api_error', 'timeout'))::INTEGER AS failures,
      round(avg(f.duration_ms) FILTER (WHERE f.duration_ms IS NOT NULL), 1) AS avg_duration_ms,
      round((percentile_cont(0.5) WITHIN GROUP (ORDER BY f.duration_ms)
        FILTER (WHERE f.duration_ms IS NOT NULL))::NUMERIC, 1) AS p50_duration_ms,
      round((percentile_cont(0.95) WITHIN GROUP (ORDER BY f.duration_ms)
        FILTER (WHERE f.duration_ms IS NOT NULL))::NUMERIC, 1) AS p95_duration_ms,
      sum(f.reasoning_tokens)::INTEGER AS reasoning_tokens,
      sum(f.completion_tokens)::INTEGER AS completion_tokens,
      round(sum(f.cost_usd), 8) AS cost_usd
    FROM filtered AS f
  ),
  attempt_totals AS (
    SELECT
      count(*)::INTEGER AS linked_attempts,
      count(*) FILTER (WHERE status = 'succeeded_with_fallback')::INTEGER AS fallback_attempts
    FROM linked_attempts
  )
  SELECT jsonb_build_object(
    'calls', totals.calls,
    'valid_success', totals.valid_success,
    'valid_success_rate', CASE
      WHEN totals.calls = 0 THEN NULL
      ELSE round((totals.valid_success::NUMERIC / totals.calls), 4)
    END,
    'failures', totals.failures,
    'avg_duration_ms', totals.avg_duration_ms,
    'p50_duration_ms', totals.p50_duration_ms,
    'p95_duration_ms', totals.p95_duration_ms,
    'reasoning_tokens', totals.reasoning_tokens,
    'completion_tokens', totals.completion_tokens,
    'cost_usd', totals.cost_usd,
    'linked_attempts', attempt_totals.linked_attempts,
    'fallback_attempts', attempt_totals.fallback_attempts,
    'fallback_rate', CASE
      WHEN attempt_totals.linked_attempts = 0 THEN NULL
      ELSE round((attempt_totals.fallback_attempts::NUMERIC / attempt_totals.linked_attempts), 4)
    END,
    'providers', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'provider', p.provider,
          'calls', p.calls,
          'valid_success', p.valid_success,
          'valid_success_rate', CASE
            WHEN p.calls = 0 THEN NULL
            ELSE round((p.valid_success::NUMERIC / p.calls), 4)
          END,
          'failures', p.failures,
          'avg_duration_ms', p.avg_duration_ms,
          'p50_duration_ms', p.p50_duration_ms,
          'p95_duration_ms', p.p95_duration_ms,
          'reasoning_tokens', p.reasoning_tokens,
          'completion_tokens', p.completion_tokens,
          'cost_usd', p.cost_usd
        )
        ORDER BY p.provider
      ) FROM providers AS p),
      '[]'::JSONB
    )
  )
  FROM totals, attempt_totals;
$$;

REVOKE ALL ON FUNCTION public.llm_generation_metrics(TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.llm_generation_metrics(TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID)
  TO authenticated, service_role;
COMMENT ON FUNCTION public.llm_generation_metrics(TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, UUID) IS
  'Admin-only model latency, valid-response, provider, fallback, token, and cost aggregates. RLS is enforced by SECURITY INVOKER.';
