-- AI 탭별 분석 결과 저장 (종합/시장/인사이트/데이터팩트)
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS ai_responses JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN reports.ai_responses IS '탭별 AI 분석 결과 { "summary"|"logic"|"creative"|"fact": "텍스트" }';
