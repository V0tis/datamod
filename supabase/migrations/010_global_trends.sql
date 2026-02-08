-- 국가별 트렌드 키워드 캐시 (Firecrawl 크롤링 결과 저장, 캐시 우선 읽기)
CREATE TABLE IF NOT EXISTS global_trends (
  country_code TEXT PRIMARY KEY,
  keywords JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE global_trends IS '국가별 실시간 트렌드 키워드 캐시 (KR, US, JP 등)';

-- 익명 읽기 허용 (트렌드 페이지는 로그인 없이 조회)
ALTER TABLE global_trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global_trends"
  ON global_trends FOR SELECT
  USING (true);

-- 쓰기는 api/trends/update에서 service role로 upsert (RLS 우회)
