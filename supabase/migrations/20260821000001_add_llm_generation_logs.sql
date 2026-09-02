-- -----------------------------------------------------------------------------
-- Migration: add_llm_generation_logs
-- Persists raw OpenRouter requests/responses (and reasoning traces) for every
-- workout generation so the admin dashboard can debug bad model output, e.g.
-- exercises generated with a 0 kg load.
--
-- Written exclusively by edge functions via the service role key.
-- Readable only by admins (see 20260821000000_add_admin_role.sql).
-- -----------------------------------------------------------------------------

CREATE TABLE llm_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pending_workout_id UUID,

  function_name TEXT NOT NULL,
  model TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'parse_error', 'api_error', 'timeout')),

  request_messages JSONB NOT NULL,
  raw_response JSONB,
  parsed_content JSONB,
  reasoning_content TEXT,

  error_message TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  prompt_tokens INTEGER CHECK (prompt_tokens IS NULL OR prompt_tokens >= 0),
  completion_tokens INTEGER CHECK (completion_tokens IS NULL OR completion_tokens >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE llm_generation_logs IS 'Raw LLM request/response traces for workout generation debugging.';

CREATE INDEX idx_llm_generation_logs_created_at
  ON llm_generation_logs(created_at DESC);

CREATE INDEX idx_llm_generation_logs_user_id
  ON llm_generation_logs(user_id, created_at DESC);

ALTER TABLE llm_generation_logs ENABLE ROW LEVEL SECURITY;

-- No user policies on purpose: regular users must never read generation logs.
-- Writes happen through the service role key, which bypasses RLS.

CREATE POLICY llm_generation_logs_select_admin
  ON llm_generation_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());
