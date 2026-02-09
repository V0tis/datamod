-- 트랜잭션 보장: 국가별 기존 데이터 삭제 후 새 데이터 삽입을 한 트랜잭션으로 수행
-- 삭제만 되고 삽입이 실패하는 상황 방지

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
  -- 1) 해당 country_code 기존 레코드 전부 삭제
  DELETE FROM global_trends WHERE country_code = p_country_code;

  -- 2) 삭제 직후에만 새 데이터 삽입 (p_rows가 비어 있지 않을 때)
  IF jsonb_array_length(p_rows) > 0 THEN
    INSERT INTO global_trends (
      country_code,
      keyword,
      rank,
      search_volume,
      started_at,
      analysis_keywords,
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
      COALESCE((e->>'created_at')::timestamptz, now())
    FROM jsonb_array_elements(p_rows) AS e;
  END IF;
END;
$$;

COMMENT ON FUNCTION upsert_country_trends(text, jsonb) IS '국가별 트렌드 캐시: DELETE 후 INSERT (단일 트랜잭션). p_rows: [{ keyword, rank, search_volume, started_at, analysis_keywords, created_at? }]';
