-- 키워드·국가별로 research_history가 있으면 다른 계정이라도 해당 데이터를 조회할 수 있도록 허용
-- (results 페이지에서 캐시 우선 로드 시, 키워드+국가 일치하는 최신 행 사용)

-- research_history: 로그인한 사용자는 키워드+국가 일치하는 모든 행 조회 가능
CREATE POLICY research_history_select_shared ON research_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- reports: research_history에 참조된 report는 누구나 조회 가능 (캐시된 키워드 결과 공유)
CREATE POLICY "Reports readable when referenced by research_history" ON reports
  FOR SELECT
  USING (
    id IN (SELECT report_id FROM research_history WHERE report_id IS NOT NULL)
  );
