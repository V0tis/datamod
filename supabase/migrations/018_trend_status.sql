-- 트렌드 수집 출처 및 상태 추적 (웹 우선 / RSS 폴백)
CREATE TABLE IF NOT EXISTS trend_status (
  country_code TEXT PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('WEB', 'RSS')),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_hours INT NOT NULL DEFAULT 24
);

COMMENT ON TABLE trend_status IS '국가별 트렌드 수집 출처(WEB/RSS) 및 마지막 갱신 시각';
COMMENT ON COLUMN trend_status.source_type IS 'WEB=실시간 웹 페이지, RSS=백업 피드';
COMMENT ON COLUMN trend_status.target_hours IS '수집 시 요청한 시간 범위(4 또는 24)';

ALTER TABLE trend_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read trend_status"
  ON trend_status FOR SELECT
  USING (true);

CREATE POLICY "Backend can insert trend_status"
  ON trend_status FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Backend can update trend_status"
  ON trend_status FOR UPDATE
  USING (true)
  WITH CHECK (true);
