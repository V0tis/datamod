# reports 테이블 참고

## 테이블이 이미 있는 경우 (기존 프로젝트)

현재 `reports` 테이블은 `id`, `user_id`, `keyword`, `content`(JSONB), `created_at` 컬럼을 사용합니다.  
다른 기기에서도 수집 뉴스 링크를 보려면 **반드시** `source_links` 컬럼을 추가하세요.

- **파일**: `supabase/migrations/005_reports_source_links.sql`  
- Supabase SQL Editor에서 해당 파일 내용을 실행한 뒤, 앱에서 리포트 저장 시 `source_links`가 함께 저장됩니다.

## 테이블이 없을 때 처음 생성하는 SQL

Supabase에 `reports` 테이블이 아직 없다면, 아래 SQL을 Supabase SQL Editor에서 실행해 생성할 수 있습니다.  
(요청하신 `summary_content`, `source_links` 컬럼명으로 구성했습니다. 앱 코드는 `content` 이름도 함께 지원합니다.)

```sql
-- Rin-AI 리포트 (다른 기기에서도 동기화)
-- auth.users와 연동하려면 user_id는 auth.uid()와 매칭되는 값으로 저장

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  summary_content JSONB NOT NULL DEFAULT '{}',
  source_links JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- RLS (Row Level Security): 본인 데이터만 접근
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports"
  ON reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reports"
  ON reports FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reports"
  ON reports FOR DELETE USING (auth.uid() = user_id);
```

- `summary_content`: AI 분석 결과 (marketNews, painPoints, competitorTrends, sentiment 등).
- `source_links`: 수집 뉴스 소스 배열 `[{ "title": "...", "url": "..." }]`.

기존 마이그레이션(002)은 `content` 컬럼으로 생성되어 있으므로, 위 스키마는 **새 프로젝트** 또는 테이블을 새로 만들 때만 사용하세요.
