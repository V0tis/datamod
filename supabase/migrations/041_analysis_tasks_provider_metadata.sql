-- Multi-LLM transparency: which provider ran each step and whether fallback was used
ALTER TABLE analysis_tasks
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN DEFAULT false;

COMMENT ON COLUMN analysis_tasks.provider IS 'AI provider id: gemini | groq; null for non-AI steps (e.g. signal_layer)';
COMMENT ON COLUMN analysis_tasks.fallback_used IS 'True when fallback model was used after primary failed';
