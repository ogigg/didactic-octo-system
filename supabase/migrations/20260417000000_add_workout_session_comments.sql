-- workout_session_comments: Freeform user feedback per completed workout.
-- Used to condition subsequent workout generation (last 3 comments are
-- appended to the LLM prompt) and shown read-only in workout history.

CREATE TABLE workout_session_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  comment TEXT NOT NULL CHECK (char_length(comment) >= 1 AND char_length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wsc_user_created_at
  ON workout_session_comments(user_id, created_at DESC);
CREATE INDEX idx_wsc_session
  ON workout_session_comments(workout_session_id);

ALTER TABLE workout_session_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY wsc_select_own ON workout_session_comments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY wsc_insert_own ON workout_session_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY wsc_service_role_all ON workout_session_comments
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
