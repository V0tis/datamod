-- 해외 트렌드 자동 번역: 키워드·뉴스 제목 한국어
ALTER TABLE global_trends
  ADD COLUMN IF NOT EXISTS title_ko TEXT,
  ADD COLUMN IF NOT EXISTS news_items_ko JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN global_trends.title_ko IS '번역된 키워드(한국어). geo=KR이면 null 또는 keyword와 동일';
COMMENT ON COLUMN global_trends.news_items_ko IS '번역된 뉴스 배열: [{ "title", "title_ko", "url", "source?", "image?" }]';
