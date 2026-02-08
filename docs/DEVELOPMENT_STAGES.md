# 린(Rin) 개발 단계 권장 순서

가장 안정적인 개발을 위해 아래 순서대로 진행하는 것을 권장합니다.

---

## 1단계: 설정 페이지 및 라이선스 키 관리 구축

**목표:** 사용자가 직접 API 키를 입력하고 저장할 수 있는 기반 마련.

**핵심:**
- `user_settings` 테이블 연동 (Gemini, Firecrawl, OpenAI)
- 키 원문은 절대 클라이언트에 노출하지 않고, 등록 여부만 표시
- 마스킹된 키 노출 UI: 등록 시 placeholder `•••••••••••• (등록됨)` 및 "직접 입력 / 서버 제공" Badge

**현재 상태:**
- [x] `user_settings` (gemini_api_key, firecrawl_api_key, openai_api_key) 연동
- [x] GET/POST `/api/settings` — 키 원문 미반환, hasXxxKey·licenseOrigin 반환
- [x] 설정 페이지: 내 정보 탭, 라이선스 탭 (Gemini, Firecrawl, OpenAI Fallback)
- [x] 사용자 입력 키 우선: `lib/license.ts` — getEffectiveLicenseKeys, getEffectiveOpenAIKey

**마이그레이션:** `supabase/migrations/013_user_settings_openai.sql` 실행 후 OpenAI 키 저장 가능.

---

## 2단계: 국가별 트렌드 수집 로직 교정 (RSS)

**목표:** 404 에러와 데이터 오염(메뉴명 수집) 해결.

**핵심:**
- 구글 트렌드 RSS URL 사용 (`https://trends.google.com/trending/rss?geo=KR` 등)
- 수집 트리거를 **[트렌드 갱신]** 버튼으로 한정 (메인 진입 시 자동 수집 없음)
- Home, Explore 등 메뉴성 텍스트 필터(블랙리스트)

**현재 상태:**
- [x] GET `/api/trends`: 캐시만 반환, 수집 미호출
- [x] POST `/api/trends/update`: [트렌드 갱신] 버튼에서만 호출
- [x] `lib/trends-cache.ts`: RSS 파싱, 키워드 블랙리스트 적용
- [x] search_volume, started_at, analysis_keywords 매핑 후 global_trends 저장

---

## 3단계: 리서치 결과 AI 탭 시스템 연동

**목표:** GPT, Gemini, Claude를 활용한 다각도 분석 제공.

**핵심:**
- Lazy Loading: 탭 클릭 시 해당 탭 API 호출
- **사용자 입력 키 우선** 적용 (1단계와 연동)
- Fallback: Gemini 실패 시 사용자/서버 OpenAI 키로 gpt-4o-mini 호출

**현재 상태:**
- [x] 종합 분석: 스트림(Gemini) 페이지 로드 시 실행
- [x] 시장 분석(Logic) / 인사이트(Insight) / 데이터 팩트(Fact): 탭 클릭 시 Lazy 호출
- [x] 탭 API: Gemini 사용, 실패 시 getEffectiveOpenAIKey()로 Fallback (gpt-4o-mini)
- [x] 설정 페이지에서 OpenAI 키 저장 시 Fallback에 사용자 키 적용

---

## 환경 변수 요약

| 변수 | 용도 |
|------|------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (서버 기본값) |
| `GEMINI_MODEL` | 사용 모델 (기본 gemini-2.0-flash) |
| `FIRECRAWL_API_KEY` | 검색 (서버 기본값) |
| `OPENAI_API_KEY` | 탭 Fallback (서버 기본값) |
| `OPENAI_FALLBACK_MODEL` | Fallback 모델 (기본 gpt-4o-mini) |
| `NEXT_PUBLIC_SUPABASE_*` | Supabase 클라이언트 |

사용자가 설정에서 입력한 키는 DB에 저장되며, 해당 키가 있으면 서버 env보다 우선 사용됩니다.
