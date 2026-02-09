-- 트렌드 상세: 그래프 이미지(picture_url), 관련 뉴스 배열(news_items)
ALTER TABLE global_trends
  ADD COLUMN IF NOT EXISTS picture_url TEXT,
  ADD COLUMN IF NOT EXISTS news_items JSONB NOT NULL DEFAULT '[]';

COMMENT ON COLUMN global_trends.picture_url IS 'RSS ht:picture 그래프 이미지 URL';
COMMENT ON COLUMN global_trends.news_items IS 'RSS 뉴스 목록: [{ "title", "url", "source?", "image?" }]';
