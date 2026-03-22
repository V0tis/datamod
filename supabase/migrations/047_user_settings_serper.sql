-- Serper API key for web search grounding (trend analysis, competitor search)
-- User key from settings; fallback to SERPER_API_KEY env
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS serper_api_key TEXT;

COMMENT ON COLUMN user_settings.serper_api_key IS 'Serper API 키 (웹 검색·경쟁사 검색 그라운딩용, Serper.dev)';
