# Rin-AI

키워드 기반 **시장 리서치 플랫폼**입니다.  
최신 뉴스를 수집·분석해 리포트 요약, 감성/영향력 차트, 유저 반응 예측을 한 번에 제공합니다.

- **UI**: Next.js (App Router), Tailwind CSS, shadcn/ui, recharts  
- **AI**: Google Gemini (통합 원샷 분석)  
- **수집**: Firecrawl  
- **배포**: Vercel

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **통합 분석** | 뉴스 수집 후 Gemini 한 번 호출로 리포트·차트 데이터·유저 반응·기사 요약을 동시에 생성 |
| **실시간 트렌드** | 한국(KR) / 미국(US) / 일본(JP) 국가별 인기 검색어 페이지 (`/trends`), 클릭 시 즉시 분석 실행 |
| **에너지 바** | 상단 QuotaBar로 Gemini 일일 잔여 쿼터(%) 표시 (Green → Orange → Red) |
| **리소스 대시보드** | Gemini·Firecrawl·Supabase 사용량 시각화 (`/dashboard/usage`) |
| **결과 탭** | 리포트 / 데이터 분석(감성 파이·영향력 레이더) / 유저 반응 / 뉴스 |
| **인증** | 이메일 OTP (Resend), Supabase Auth |

---

## 실행 방법

```bash
yarn install
cp .env.example .env.local   # 필요 시
yarn dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

---

## 환경 변수

프로젝트 루트에 `.env.local` (또는 `.env`)을 만들고 아래 값을 채우세요.

```bash
# Supabase (Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Resend (이메일 OTP)
RESEND_API_KEY=your_resend_key
EMAIL_FROM="Rin-AI <onboarding@resend.dev>"

# 리서치 (필수)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key

# 선택 (기본값 사용 가능)
GEMINI_MODEL=gemini-2.0-flash
```

---

## Supabase 마이그레이션

Supabase 대시보드 → SQL Editor에서 아래 순서대로 실행하세요.

1. `supabase/migrations/001_auth_tables.sql` — 인증 관련 테이블  
2. `supabase/migrations/002_reports_table.sql` — `reports` (리포트 저장)  
3. `supabase/migrations/003_profiles_simplify_for_supabase_auth.sql`  
4. `supabase/migrations/004_reports_rls.sql` — RLS 정책  
5. `supabase/migrations/005_reports_source_links.sql`  
6. `supabase/migrations/006_reports_share_token.sql`  
7. `supabase/migrations/007_usage_stats.sql` — `usage_stats` (Gemini/Firecrawl 사용량)

---

## 프로젝트 구조 요약

```
app/
  page.tsx              # 메인 검색
  trends/page.tsx        # 실시간 트렌드 (국가별 키워드)
  results/page.tsx       # 분석 결과 (리포트·차트·유저반응·뉴스 탭)
  dashboard/             # 대시보드
  dashboard/usage/       # 리소스 사용량
  api/research/stream/   # 스트리밍 통합 분석 API
  api/usage/             # 사용량 조회 API
components/
  quota-bar.tsx          # 상단 에너지(쿼터) 바
  sidebar.tsx            # 네비게이션 + 트렌드 링크
  research-charts.tsx    # 감성 파이 / 영향력 레이더 (recharts)
lib/
  stores/research-store.ts  # 검색·결과·쿼터 상태
  usage.ts                  # 사용량 기록 (trackUsage)
```

---

## 라이선스

Private.
