-- saved_insights: PM knowledge layer — save analysis snapshots for later reference
-- Separate from raw analysis; snapshot is a structured copy at save time.

CREATE TABLE IF NOT EXISTS saved_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  note TEXT,
  snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_insights_user_created
  ON saved_insights(user_id, created_at DESC);

COMMENT ON TABLE saved_insights IS 'PM 저장 인사이트: 분석 결과 스냅샷 + 이름·메모';
COMMENT ON COLUMN saved_insights.snapshot IS '저장 시점 스냅샷: keyword, countryCode, summary, strategicSummary, actionItems, reportId 등';

ALTER TABLE saved_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_insights_select_own ON saved_insights
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY saved_insights_insert_own ON saved_insights
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY saved_insights_delete_own ON saved_insights
  FOR DELETE USING (auth.uid() = user_id);
