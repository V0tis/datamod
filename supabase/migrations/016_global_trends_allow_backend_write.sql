-- global_trends: API에서 캐시 갱신 시 INSERT/DELETE 허용 (서버·anon 모두)
-- 기존에는 SELECT만 가능해 갱신 시 권한 오류가 날 수 있음

CREATE POLICY "Allow backend to insert global_trends"
  ON global_trends FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow backend to delete global_trends"
  ON global_trends FOR DELETE
  USING (true);

COMMENT ON TABLE global_trends IS '국가별 실시간 트렌드 캐시 (API에서 RSS 수집 후 갱신)';
