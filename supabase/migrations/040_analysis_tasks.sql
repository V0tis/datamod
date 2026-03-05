-- analysis_tasks: 분석 파이프라인 단계별 작업 추적
-- 각 분석(analysis_id = user_id|keyword|country_code)의 step별 상태 저장
CREATE TABLE IF NOT EXISTS analysis_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  output_data JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(analysis_id, step_name)
);

CREATE INDEX IF NOT EXISTS idx_analysis_tasks_analysis_id ON analysis_tasks(analysis_id);

-- RLS 활성화
ALTER TABLE analysis_tasks ENABLE ROW LEVEL SECURITY;

-- authenticated: 본인 analysis_id (userId|...) 로 시작하는 행만 읽기
CREATE POLICY analysis_tasks_select_own ON analysis_tasks
  FOR SELECT
  TO authenticated
  USING (analysis_id LIKE (auth.uid()::text || '|%'));
