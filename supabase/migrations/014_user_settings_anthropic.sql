-- Anthropic (Claude) API key for user override
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;

COMMENT ON COLUMN user_settings.anthropic_api_key IS 'Anthropic (Claude) API key (optional)';
