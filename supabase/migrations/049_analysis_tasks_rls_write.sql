-- analysis_tasks: 서비스 롤 없이도 로그인 사용자가 본인 analysis_id 행을 upsert 할 수 있도록
-- (Vercel 등에서 SUPABASE_SERVICE_ROLE_KEY 미설정 시 runResearch가 동작하도록)

CREATE POLICY analysis_tasks_insert_own ON analysis_tasks
  FOR INSERT TO authenticated
  WITH CHECK (analysis_id LIKE (auth.uid()::text || '|%'));

CREATE POLICY analysis_tasks_update_own ON analysis_tasks
  FOR UPDATE TO authenticated
  USING (analysis_id LIKE (auth.uid()::text || '|%'))
  WITH CHECK (analysis_id LIKE (auth.uid()::text || '|%'));

COMMENT ON POLICY analysis_tasks_insert_own ON analysis_tasks IS '본인 analysis_id(userId|keyword|country)만 삽입';
COMMENT ON POLICY analysis_tasks_update_own ON analysis_tasks IS '본인 analysis_id 행만 갱신';
