-- reports 테이블 RLS: 본인 데이터만 접근 (A유저 결과가 B유저 히스토리에 보이지 않도록)
-- profiles.id = auth.users.id 이므로 auth.uid() = user_id 로 본인 행만 허용

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports"
  ON reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE reports IS '검색 키워드별 Claude 분석 결과 (계정별 저장, RLS 적용)';
