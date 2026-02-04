-- Rin-AI 검색/분석 리포트 (계정별 귀속)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  summary JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

COMMENT ON TABLE reports IS '검색 키워드별 Claude 분석 결과 (계정별 저장)';
COMMENT ON COLUMN reports.id IS '리포트 고유 ID (Primary Key)';
COMMENT ON COLUMN reports.user_id IS '작성자 ID (auth_users 테이블 외래키)';
COMMENT ON COLUMN reports.keyword IS '검색 키워드';
COMMENT ON COLUMN reports.summary IS 'Claude가 분석한 전체 결과 (뉴스, 페인포인트 등)';
COMMENT ON COLUMN reports.created_at IS '분석 일시';
