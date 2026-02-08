-- OpenAI API 키 (Fallback용): 사용자 입력 키 우선 적용
-- Supabase SQL Editor에서 실행

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS openai_api_key TEXT;

COMMENT ON COLUMN user_settings.openai_api_key IS 'OpenAI API 키 (탭 Fallback 시 사용, 선택)';
