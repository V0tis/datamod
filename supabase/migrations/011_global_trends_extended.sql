-- 확장 스키마: 트렌드당 한 행 (country_code + rank), 검색량·시작시점·분석키워드 포함
DROP TABLE IF EXISTS global_trends;

CREATE TABLE global_trends (
  country_code TEXT NOT NULL,
  keyword TEXT NOT NULL,
  rank INT NOT NULL,
  search_volume TEXT,
  started_at TEXT,
  analysis_keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (country_code, rank)
);

CREATE INDEX idx_global_trends_country ON global_trends(country_code);
COMMENT ON TABLE global_trends IS '국가별 실시간 트렌드 상세 (키워드, 순위, 검색량, 시작시점, 분석키워드)';

ALTER TABLE global_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global_trends"
  ON global_trends FOR SELECT
  USING (true);
