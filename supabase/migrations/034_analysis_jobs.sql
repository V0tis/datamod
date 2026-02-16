-- analysis_jobs: background analysis queue per user/keyword
CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT 'KR',
  status TEXT NOT NULL DEFAULT 'queued',
  progress_step TEXT,
  error TEXT,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_updated_at
  ON analysis_jobs(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status
  ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_keyword
  ON analysis_jobs(keyword);

COMMENT ON TABLE analysis_jobs IS '비동기 분석 작업 큐';
COMMENT ON COLUMN analysis_jobs.status IS 'queued|running|succeeded|failed|cancelled';
COMMENT ON COLUMN analysis_jobs.progress_step IS 'news|gemini|parse_json|report_db|done|cached';

-- RLS: 본인 작업만 조회/수정
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY analysis_jobs_select_own ON analysis_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY analysis_jobs_insert_own ON analysis_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY analysis_jobs_update_own ON analysis_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY analysis_jobs_delete_own ON analysis_jobs
  FOR DELETE USING (auth.uid() = user_id);
