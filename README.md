# Rin-AI

키워드 기반 **시장 리서치 플랫폼**입니다.  
최신 뉴스를 수집·분석해 리포트 요약, 감성/영향력 차트, 유저 반응 예측을 한 번에 제공합니다.

- **UI**: Next.js (App Router), Tailwind CSS, shadcn/ui, recharts  
- **AI**: Google Gemini (통합 원샷 분석, Google Search 도구로 실시간 웹 참고)  
- **수집**: 구글 트렌드 RSS (국가별 트렌드), Gemini Google Search (뉴스·분석)  
- **배포**: Vercel

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **통합 분석** | 뉴스 수집 후 Gemini 한 번 호출로 리포트·차트 데이터·유저 반응·기사 요약을 동시에 생성 |
| **실시간 트렌드** | 한국(KR) / 미국(US) / 일본(JP) 국가별 인기 검색어 페이지 (`/trends`), 클릭 시 즉시 분석 실행 |
| **에너지 바** | 상단 QuotaBar로 Gemini 일일 잔여 쿼터(%) 표시 (Green → Orange → Red) |
| **결과 탭** | 리포트 / 데이터 분석(감성 파이·영향력 레이더) / 유저 반응 / 뉴스 / 인사이트 |
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

# 선택 (기본값: gemini-1.5-flash-latest, 404 시 GEMINI_MODEL=gemini-2.0-flash 시도)
GEMINI_MODEL=gemini-1.5-flash-latest

# OpenAI — 인사이트 탭 Fallback (선택)
OPENAI_API_KEY=your_openai_api_key
```

---

## Supabase 마이그레이션

**권장:** 프로젝트 연결 후 CLI로 한 번에 적용합니다.

```bash
npx supabase login   # 최초 1회
npx supabase link --project-ref <프로젝트_Reference_ID>
npx supabase db push
```

마이그레이션 파일은 `supabase/migrations/` 에 있으며, 인증·reports·RLS·usage_stats·global_trends·trend_status 등이 순서대로 정의되어 있습니다. CLI 사용이 어려우면 Supabase 대시보드 → SQL Editor에서 `001_` 부터 순서대로 실행하면 됩니다.

---

## 프로젝트 구조 요약

```
app/
  page.tsx                 # 메인 검색
  trends/page.tsx          # 실시간 트렌드 (국가별 키워드)
  results/page.tsx         # 분석 결과 (리포트·차트·유저반응·뉴스·인사이트 탭)
  history/page.tsx         # 내 리서치 기록
  settings/page.tsx        # 설정 (닉네임, Gemini·OpenAI API 키)
  auth/                    # 로그인·회원가입·OTP 검증
  api/
    research/              # POST 분석, stream 스트리밍, insights 인사이트
    trends/                 # 트렌드 캐시 조회·갱신
    usage/                  # 사용량 조회 (Gemini 일일)
components/
  sidebar.tsx              # 네비게이션 + 트렌드 링크
  research-charts.tsx      # 감성 파이 / 영향력 레이더 (recharts)
  research-report-view.tsx # 리포트·뉴스 뷰
lib/
  stores/research-store.ts # 검색·결과·쿼터 상태
  license.ts               # API 키 결정 (Gemini, OpenAI)
  usage.ts                 # 사용량 기록 (trackUsage)
  trends-cache.ts          # 구글 트렌드 RSS 수집 (국가별 키워드·뉴스·title_ko)
```

---

## 라이선스

Private.
