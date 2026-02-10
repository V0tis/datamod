-- research_history: 키워드/국가별 분석 캐시 (Gemini 비용 절감)
-- reports와 1:1 연결 (report_id), 탭별 텍스트·핵심 수치·updated_at 저장

CREATE TABLE IF NOT EXISTS research_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'KR',
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  analysis_market TEXT,
  analysis_insight TEXT,
  analysis_report TEXT,
  key_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, keyword, country_code)
);

CREATE INDEX IF NOT EXISTS idx_research_history_user_keyword_country
  ON research_history(user_id, keyword, country_code);
CREATE INDEX IF NOT EXISTS idx_research_history_report_id
  ON research_history(report_id);
CREATE INDEX IF NOT EXISTS idx_research_history_updated_at
  ON research_history(updated_at DESC);

COMMENT ON TABLE research_history IS '키워드/국가별 분석 캐시 (시장·인사이트·리포트·핵심수치). 재분석 시 UPDATE';
COMMENT ON COLUMN research_history.analysis_market IS 'AI 시장 분석 결과 (logic 탭)';
COMMENT ON COLUMN research_history.analysis_insight IS 'AI 인사이트 결과 (creative 탭)';
COMMENT ON COLUMN research_history.analysis_report IS 'AI 종합 리포트 결과 (fact 탭)';
COMMENT ON COLUMN research_history.key_metrics IS 'AI 추출 핵심 수치 (chartData, keyConclusions 등)';
COMMENT ON COLUMN research_history.updated_at IS '마지막 분석 시간';

-- RLS: 본인 행만 조회/수정
ALTER TABLE research_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY research_history_select_own ON research_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY research_history_insert_own ON research_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY research_history_update_own ON research_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY research_history_delete_own ON research_history
  FOR DELETE USING (auth.uid() = user_id);
