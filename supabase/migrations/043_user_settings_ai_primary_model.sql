-- AI 우선 분석 모델 설정 (Gemini 또는 Groq)
-- 기본값: gemini (기존 동작 유지)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS ai_primary_model TEXT DEFAULT 'gemini' CHECK (ai_primary_model IN ('gemini', 'groq'));

COMMENT ON COLUMN user_settings.ai_primary_model IS 'AI 우선 분석: gemini | groq (실패 시 다른 모델로 폴백)';
