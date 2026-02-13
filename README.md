# Rin-AI

키워드 기반 **시장 리서치 플랫폼**입니다.  
최신 뉴스를 수집·분석해 리포트 요약, 감성/영향력 차트, 유저 반응 예측을 한 번에 제공합니다.

- **UI**: Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui, Pretendard 웹폰트, 카드 기반 Dashlite 스타일
- **AI**: Google Gemini 3 / Gemini 2.0 + Groq (Llama) 듀얼 엔진, Read-through 캐싱
- **수집**: 구글 트렌드 RSS (국가별 트렌드), 뉴스·분석
- **배포**: Vercel

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **듀얼 엔진 분석** | 시장 분석·인사이트·종합 리포트 탭에서 **Gemini**와 **Groq(Llama)** 동시 호출, 2열 그리드로 비교 표시 |
| **Read-through 캐시** | 키워드·국가별로 Supabase `research_history`에 결과 저장. 재방문 시 API 호출 없이 즉시 표시, 재분석 시에만 재호출 |
| **통합 스트리밍** | 뉴스 수집 후 Gemini 한 번 호출로 리포트·차트·유저 반응·기사 요약 동시 생성 |
| **실시간 트렌드** | 한국(KR) / 미국(US) / 일본(JP) 등 국가별 인기 검색어 (`/trends`), 클릭 시 즉시 분석 |
| **결과 탭** | 시장 분석 / 인사이트 / 종합 리포트 (Gemini·Groq 1:1), 실시간 뉴스, PDF·공유 |
| **인증** | 이메일 OTP (Resend), Supabase Auth |

---

## 기술 스택 (2026)

- **Framework**: Next.js 16, React 19
- **스타일**: Tailwind CSS 4, Pretendard 폰트, 다크 모드 (next-themes)
- **AI**: Google Gemini (gemini-2.5-flash), Groq (llama-3.3-70b-versatile)
- **DB**: Supabase (Auth, Postgres, RLS)
- **상태**: Zustand, SWR

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

# 리서치 — Gemini (아래 중 하나만 설정해도 동작)
GEMINI_API_KEY=your_gemini_api_key
# 또는
GOOGLE_GENAI_API_KEY=your_gemini_api_key
# 또는
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# 리서치 — Groq (탭 분석용)
GROQ_API_KEY=your_groq_api_key

# 선택 (기본값 사용 시 생략 가능)
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TAB_MODEL=gemini-2.5-flash
GROQ_TAB_MODEL=llama-3.3-70b-versatile

# OpenAI — 인사이트 Fallback (선택)
OPENAI_API_KEY=your_openai_api_key
```

대시보드의 **API 연결 상태**는 `GEMINI_API_KEY`, `GOOGLE_GENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `NEXT_PUBLIC_GEMINI_API_KEY` 중 하나라도 설정되면 Gemini를 "연결됨"으로 표시합니다.

---

## Supabase 마이그레이션

**권장:** 프로젝트 연결 후 CLI로 한 번에 적용합니다.

```bash
npx supabase login   # 최초 1회
npx supabase link --project-ref <프로젝트_Reference_ID>
npx supabase db push
```

마이그레이션 파일은 `supabase/migrations/` 에 있으며, 인증·reports·RLS·usage_stats·global_trends·research_history 등이 순서대로 정의되어 있습니다.  
- `032_research_history_drop_analysis_hf.sql`: Hugging Face 제거에 따른 `analysis_hf` 컬럼 삭제.  
CLI 사용이 어려우면 Supabase 대시보드 → SQL Editor에서 `001_` 부터 순서대로 실행하면 됩니다.

---

## 프로젝트 구조 요약

```
app/
  page.tsx                 # 메인 검색 (트렌드·최근 기록·API 연결 상태)
  trends/page.tsx          # 실시간 트렌드 (국가별 키워드)
  results/page.tsx         # 분석 결과 (시장 분석·인사이트·종합 리포트, Gemini·Groq 2열)
  results/[id]/page.tsx    # 공유 리포트 (token)
  history/page.tsx         # 내 리서치 기록
  settings/page.tsx        # 설정 (닉네임, Gemini·OpenAI·Anthropic API 키)
  auth/                    # 로그인·회원가입·OTP 검증
  api/
    health/                # API 연결 상태 (Gemini, Supabase)
    research/              # POST 분석, stream 스트리밍
    research/insights/tab/  # 탭별 Gemini·Groq 호출, Read-through 캐시
    research/history/      # 키워드별 캐시 조회
    trends/                # 트렌드 캐시 조회·갱신
    usage/                 # 사용량 조회 (Gemini 일일)
components/
  sidebar.tsx              # 네비게이션 + 트렌드 링크
  research-charts.tsx      # 24시간 감성 추이 스택 영역 차트 (recharts)
  research-report-view.tsx # 리포트·뉴스 뷰
lib/
  stores/research-store.ts # 검색·결과·쿼터 상태
  license.ts               # API 키 결정 (Gemini, OpenAI, Anthropic), getSystemGeminiKey()
  usage.ts                 # 사용량 기록 (trackUsage)
  trends-cache.ts          # 구글 트렌드 RSS 수집 (국가별 키워드·뉴스)
```

---

## 라이선스

Private.
