-- Per-user LLM usage (tokens + model) for settings dashboard and cost awareness
CREATE TABLE IF NOT EXISTS llm_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  analysis_id TEXT,
  step_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'groq')),
  model TEXT NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  long_context_route BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_log_user_created ON llm_usage_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_log_user ON llm_usage_log (user_id);

COMMENT ON TABLE llm_usage_log IS '분석 파이프라인 LLM 호출별 토큰·모델 기록';

ALTER TABLE llm_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own llm_usage_log"
  ON llm_usage_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own llm_usage_log"
  ON llm_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
