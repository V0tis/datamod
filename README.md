This project is my personal AI maid.
When I enter keywords for a specific industry, it crawls the latest news, competitor trends, and user reviews, then summarizes them and generates a SWOT analysis report.

ui: v0 dev
dev: cursor claude 3.5 sonnet
deployed: vercel
firecrawl+claude

## Environment Variables

Create a `.env.local` (or `.env`) in the project root with:

```bash
# Supabase (Dashboard → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# 서버에서 회원가입/인증 처리 시 사용 (Dashboard → API → service_role)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Resend (이메일 OTP 발송)
RESEND_API_KEY=your_resend_key
EMAIL_FROM="Rin-AI <onboarding@resend.dev>"

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=random_string_at_least_32_chars

# 리서치 API (기존)
FIRECRAWL_API_KEY=
ANTHROPIC_API_KEY=
```

### Supabase 테이블 생성

Supabase 대시보드 → SQL Editor에서 `supabase/migrations/001_auth_tables.sql` 내용을 실행해 `auth_users`, `one_time_tokens` 테이블을 생성하세요.

