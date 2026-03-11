-- analysis_history: Every completed AI analysis result (no overwrite)
-- Used for "My Analyses" page - list, search, open previous result

CREATE TABLE IF NOT EXISTS analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  market_keyword TEXT NOT NULL,
  product_name TEXT,
  generated_insights JSONB,
  strategy_recommendation TEXT,
  action_plan JSONB,
  country_code TEXT NOT NULL DEFAULT 'KR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_history_market_keyword ON analysis_history(market_keyword);
CREATE INDEX IF NOT EXISTS idx_analysis_history_product_name ON analysis_history(product_name);

COMMENT ON TABLE analysis_history IS '모든 완료된 AI 분석 결과 (My Analyses 페이지용)';
COMMENT ON COLUMN analysis_history.market_keyword IS '분석 대상 시장 키워드';
COMMENT ON COLUMN analysis_history.product_name IS '제품명 (key_metrics.product_idea 등에서 추출)';
COMMENT ON COLUMN analysis_history.generated_insights IS '생성된 인사이트 (summary_insights, key_strategic_insights)';
COMMENT ON COLUMN analysis_history.strategy_recommendation IS '전략 추천 (strategy_summary, recommended_product_strategy)';
COMMENT ON COLUMN analysis_history.action_plan IS '액션 플랜 (pm_action_plan, pm_actions.recommended_actions)';

ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY analysis_history_select_own ON analysis_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY analysis_history_insert_own ON analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
