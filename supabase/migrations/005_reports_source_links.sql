-- reports 테이블에 source_links 컬럼 추가 (수집 뉴스 제목/링크 저장)
-- 다른 기기에서도 동일한 리포트를 볼 수 있도록 DB에 보강

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS source_links JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN reports.source_links IS '수집된 뉴스 소스 목록 [{ "title": "...", "url": "..." }]';
