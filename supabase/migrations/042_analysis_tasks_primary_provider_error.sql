-- primary_provider_error: reason primary (Gemini) failed when fallback to Groq was used
ALTER TABLE analysis_tasks
  ADD COLUMN IF NOT EXISTS primary_provider_error TEXT;

COMMENT ON COLUMN analysis_tasks.primary_provider_error IS 'Human-readable reason primary provider failed (e.g. quota exceeded) when fallback_used=true';
