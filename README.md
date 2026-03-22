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
| **결과 탭** | 시장 분석 / 인사이트 / 종합 리포트 (Gemini·Groq 1:1), 실시간 뉴스(기간 선택 7/14/30/90일), PDF·공유 |
| **탭 분석 격리** | Groq·Gemini 병렬 호출, 한쪽 실패 시에도 다른 쪽 결과 표시 |
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

## 배포 (외부 접속)

**Vercel로 배포하면 누구나 URL로 접속할 수 있습니다.**

1. [Vercel](https://vercel.com)에 로그인 후 **Add New → Project**에서 이 저장소(GitHub/GitLab)를 연결합니다.
2. **Environment Variables**에 `.env.local`에 넣은 값들을 그대로 등록합니다. (Supabase, Resend, Gemini, Groq 등)
3. **Deploy**를 누르면 빌드 후 `https://<프로젝트명>.vercel.app` 같은 URL이 생성됩니다.
4. (선택) 커스텀 도메인은 Vercel 대시보드 → Project → Settings → Domains에서 설정할 수 있습니다.

로컬에서 프로덕션 빌드 후 바로 실행해 보려면:

```bash
yarn build
yarn start
```

`yarn start`는 기본적으로 `http://localhost:3000`에서만 접속 가능합니다. 같은 네트워크의 다른 기기에서 접속하려면 `yarn start --hostname 0.0.0.0`으로 실행할 수 있습니다.

---

## 환경 변수

프로젝트 루트에 `.env.local` (또는 `.env`)을 만들고 아래 값을 채우세요.

```bash
# Supabase (Dashboard → Project Settings → API) — 필수
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Resend (이메일 OTP)
RESEND_API_KEY=your_resend_key
EMAIL_FROM="Rin-AI <onboarding@resend.dev>"

# 웹 검색 그라운딩 (Serper API) — 실제 사용됨
# 설정 시: 트렌드 분석·경쟁사 검색 시 키워드로 웹 검색 후 상위 소스를 LLM 컨텍스트로 전달.
# 미설정 시: 웹 검색 비활성화 → 경쟁사/포지셔닝이 거의 나오지 않을 수 있음.
SERPER_API_KEY=your_serper_api_key

# 선택 (기본값 사용 시 생략 가능)
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TAB_MODEL=gemini-2.5-flash
GROQ_TAB_MODEL=llama-3.3-70b-versatile
```

**Gemini / Groq API 키:**  
설정 → API KEY에서 사용자별로 등록합니다. `.env`의 `GEMINI_API_KEY`, `GROQ_API_KEY`는 **비로그인/시스템 fallback**용이며, 로그인 사용자는 설정 화면 값이 우선합니다.

**Vercel 배포 시:** 위 변수들을 Vercel 대시보드 → **Project → Settings → Environment Variables**에 설정하세요.  
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 필수입니다. 저장 후 **Redeploy** 한 번 해주면 적용됩니다.

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
  settings/page.tsx        # 설정 (닉네임, Gemini·Groq·Serper API 키)
  auth/                    # 로그인·회원가입·OTP 검증
  api/
    health/                # API 연결 상태 (Gemini, Supabase)
    research/              # POST 분석, stream 스트리밍
    research/insights/tab/  # 탭별 Gemini·Groq 호출, Read-through 캐시
    research/history/      # 키워드별 캐시 조회
    news/                  # 실시간 뉴스 RSS (keyword, days 파라미터, 기본 30일)
    trends/                # 트렌드 캐시 조회·갱신
    usage/                 # 사용량 조회 (Gemini 일일)
components/
  app-sidebar.tsx          # 앱 네비게이션 (app-shell 사용)
  research-report-view.tsx # 리포트·뉴스 뷰
lib/
  stores/research-store.ts # 검색·결과·쿼터 상태
  license.ts               # API 키 결정 (Gemini), getSystemGeminiKey()
  usage.ts                 # 사용량 기록 (trackUsage)
  trends-cache.ts          # 구글 트렌드 RSS 수집 (국가별 키워드·뉴스)
```

---

## 라이선스

Private.
