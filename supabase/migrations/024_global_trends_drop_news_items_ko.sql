-- news_items_ko 제거: 키워드만 번역(title_ko), 뉴스는 news_items 원문만 사용

ALTER TABLE global_trends DROP COLUMN IF EXISTS news_items_ko;

CREATE OR REPLACE FUNCTION upsert_country_trends(
  p_country_code text,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM global_trends WHERE country_code = p_country_code;

  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO global_trends (
      country_code,
      keyword,
      rank,
      search_volume,
      started_at,
      analysis_keywords,
      picture_url,
      news_items,
      title_ko,
      created_at
    )
    SELECT
      p_country_code,
      (e->>'keyword')::text,
      (e->>'rank')::int,
      (e->>'search_volume')::text,
      (e->>'started_at')::text,
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(e->'analysis_keywords', '[]'::jsonb))),
        '{}'
      ),
      (e->>'picture_url')::text,
      COALESCE(e->'news_items', '[]'::jsonb),
      (e->>'title_ko')::text,
      COALESCE((e->>'created_at')::timestamptz, now())
    FROM jsonb_array_elements(p_rows) AS e;
  END IF;
END;
$$;

COMMENT ON FUNCTION upsert_country_trends(text, jsonb) IS '국가별 트렌드 캐시: DELETE 후 INSERT. p_rows에 picture_url, title_ko 포함 (키워드만 번역)';
