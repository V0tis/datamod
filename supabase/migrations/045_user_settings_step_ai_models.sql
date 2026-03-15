-- 단계별 AI 모델 설정: 각 분석 Step마다 Gemini / Groq 개별 선택
-- NULL이면 ai_primary_model 사용 (앱 레벨 fallback)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS ai_market_model TEXT CHECK (ai_market_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_competitor_model TEXT CHECK (ai_competitor_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_insight_model TEXT CHECK (ai_insight_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_strategy_model TEXT CHECK (ai_strategy_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_action_model TEXT CHECK (ai_action_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_risk_model TEXT CHECK (ai_risk_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_creative_model TEXT CHECK (ai_creative_model IN ('gemini', 'groq')),
  ADD COLUMN IF NOT EXISTS ai_consensus_model TEXT CHECK (ai_consensus_model IN ('gemini', 'groq'));

COMMENT ON COLUMN user_settings.ai_market_model IS '시장 리서치 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_competitor_model IS '경쟁 분석 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_insight_model IS '인사이트 추출 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_strategy_model IS '전략 생성 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_action_model IS 'PM 액션 플랜 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_risk_model IS '리스크 분석 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_creative_model IS 'Creative 분석 AI (NULL = ai_primary_model)';
COMMENT ON COLUMN user_settings.ai_consensus_model IS 'Consensus 종합 AI (NULL = ai_primary_model)';
