# global_trends 테이블 참고

**실제 테이블 이름은 `trends`가 아니라 `global_trends`입니다.** 모든 API 및 저장 로직에서 이 테이블명을 사용합니다.

## 테이블: `global_trends`

국가별 실시간 트렌드 캐시. 구글 트렌드 RSS 수집 후 `upsert_country_trends` RPC로 갱신합니다.

### 컬럼

| 컬럼 | 타입 | 설명 |
|------|------|------|
| country_code | text | 국가 코드 (KR, US, JP, TW, HK, GB, DE 등) |
| keyword | text | 키워드(원문) |
| rank | int | 순위 |
| search_volume | text | 검색량(approx_traffic) |
| started_at | text | 시작 시점 |
| analysis_keywords | text[] | 연관 키워드 |
| picture_url | text | RSS ht:picture 그래프 이미지 URL |
| news_items | jsonb | 뉴스 목록: `[{ "title", "url", "source?", "image?" }]` |
| title_ko | text | 번역된 키워드(한국어). geo≠KR일 때 사용 |
| news_items_ko | jsonb | 번역된 뉴스: `[{ "title", "title_ko", "url", "source?", "image?" }]` |
| created_at | timestamptz | 생성/갱신 시각 |

### INSERT/UPDATE 방식

- **직접 INSERT/UPDATE 하지 않음.** 반드시 RPC `upsert_country_trends(p_country_code, p_rows)` 사용.
- RPC 동작: 해당 `country_code` 기존 행 전부 DELETE 후, `p_rows` 배열을 INSERT.
- `p_rows` 각 요소에는 **picture_url, title_ko, news_items_ko**를 포함해야 합니다.

### API에서의 사용

- `GET /api/trends`: `global_trends` 테이블 SELECT (country_code, keyword, rank, search_volume, started_at, analysis_keywords, **picture_url**, **news_items**, **title_ko**, **news_items_ko**, created_at).
- `POST /api/trends/update`: `refreshGlobalTrends()` 호출 → RPC로 `global_trends` 갱신 후 동일 SELECT.

### 저장 로직 (lib/trends-cache.ts)

`refreshGlobalTrends()`에서 국가별로:

1. RSS 수집 → 번역(title_ko, news_items_ko) 적용
2. `rowsForRpc`에 **picture_url**, **title_ko**, **news_items_ko** 포함하여 구성
3. `supabase.rpc('upsert_country_trends', { p_country_code, p_rows: rowsForRpc })` 호출

마이그레이션: `023_global_trends_upsert_title_ko.sql`에서 RPC가 위 컬럼들을 INSERT하도록 정의되어 있습니다.
