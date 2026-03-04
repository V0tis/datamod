-- Groq API key for user-based analysis (tab analysis, creative insights)
-- Supabase SQL Editor에서 실행

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS groq_api_key TEXT;

COMMENT ON COLUMN user_settings.groq_api_key IS 'Groq API 키 (탭 분석·인사이트 생성 시 사용)';
