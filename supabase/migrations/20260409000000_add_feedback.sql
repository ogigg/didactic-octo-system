-- feedback: User bug reports and feature requests
-- Stores feedback submissions with automatic email notification via Resend
CREATE TYPE feedback_type AS ENUM ('bug_report', 'feature_request');

CREATE TYPE feedback_status AS ENUM ('open', 'in_progress', 'resolved');

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type feedback_type NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 100),
  description TEXT NOT NULL CHECK (char_length(description) >= 1 AND char_length(description) <= 2000),
  app_version TEXT,
  device_model TEXT,
  os_version TEXT,
  platform TEXT,
  status feedback_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_status_created_at ON feedback(status, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY feedback_insert_own ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can read all feedback (for admin dashboard)
CREATE POLICY feedback_select_all ON feedback
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Service role can update feedback status
CREATE POLICY feedback_update_status ON feedback
  FOR UPDATE
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
