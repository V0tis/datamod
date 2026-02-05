-- 리소스 사용량 집계 (날짜별, 서비스별)
-- Supabase SQL Editor 또는 migration 적용

CREATE TABLE IF NOT EXISTS usage_stats (
  used_date DATE NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('gemini', 'firecrawl')),
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (used_date, service_type)
);

CREATE INDEX IF NOT EXISTS idx_usage_stats_used_date ON usage_stats(used_date);
CREATE INDEX IF NOT EXISTS idx_usage_stats_service_type ON usage_stats(service_type);

COMMENT ON TABLE usage_stats IS 'Gemini/Firecrawl 일별 호출 횟수 (할당량 모니터링용)';

-- RLS: 서버에서만 쓰고 읽기 위해 anon/authenticated 모두 허용 (내부 대시보드용)
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for anon and authenticated"
  ON usage_stats FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow insert for anon and authenticated"
  ON usage_stats FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow update for anon and authenticated"
  ON usage_stats FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
