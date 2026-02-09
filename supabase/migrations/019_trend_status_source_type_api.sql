-- source_type에 API 추가 (google-trends-api 라이브러리 사용 시)
ALTER TABLE trend_status DROP CONSTRAINT IF EXISTS trend_status_source_type_check;
ALTER TABLE trend_status ADD CONSTRAINT trend_status_source_type_check
  CHECK (source_type IN ('WEB', 'RSS', 'API'));

COMMENT ON COLUMN trend_status.source_type IS 'API=google-trends-api(realTime/daily), WEB=레거시, RSS=백업 피드';
