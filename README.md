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
# 서버에서 회원가입/로그인(auth.signUp, signInWithPassword) 시 사용
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 이메일 확인 링크 리다이렉트용 (선택, 예: https://your-app.vercel.app)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=random_string_at_least_32_chars

# 리서치 API
FIRECRAWL_API_KEY=
ANTHROPIC_API_KEY=
```

인증은 **Supabase Auth**를 사용합니다. 비밀번호는 `auth.users`에만 저장되고, `public.profiles`에는 `id`, `email`만 저장됩니다.

**이메일 플로우 (Magic Link)**  
가입 시 Supabase가 보내는 **확인 링크**를 클릭하면 → `/auth/callback`으로 리다이렉트 → **자동 로그인** 후 **대시보드(`/`)** 로 이동합니다. 별도 OTP 입력 페이지는 사용하지 않습니다.

### Supabase 설정

- **Authentication → URL Configuration**
  - **Site URL**: 앱 도메인 (예: `https://your-app.vercel.app` 또는 `http://localhost:3000`)
  - **Redirect URLs**: 아래 두 개 추가  
    `https://your-domain/auth/callback`  
    `http://localhost:3000/auth/callback`
- **Authentication → Email**: Confirm email을 켜두면 가입 후 위 확인 링크를 클릭해야 로그인 가능

### OTP(숫자 6자리) 방식으로 바꾸고 싶다면

Supabase는 이메일 템플릿으로 **링크** 또는 **숫자 코드** 중 하나를 선택할 수 있습니다.

1. **Supabase 대시보드** → **Authentication** → **Email Templates**
2. **Confirm signup** 템플릿에서:
   - 링크 방식(현재): `{{ .ConfirmationURL }}` 사용
   - **숫자 코드 방식**: `{{ .Token }}` 사용으로 변경하면 6자리 OTP가 발송됨
3. **코드 변경**: 회원가입을 `auth.signUp` 대신 `auth.signInWithOtp({ email })`로 보내고, `/auth/verify` 페이지에서 사용자가 입력한 6자리를 `auth.verifyOtp({ email, token: code, type: 'email' })`로 검증한 뒤 NextAuth 세션을 생성하도록 수정하면 됩니다.

### Supabase 테이블 생성

Supabase 대시보드 → SQL Editor에서 순서대로 실행하세요.

1. `supabase/migrations/001_auth_tables.sql` — `profiles` (id, email만, id는 auth.users 참조)
2. `supabase/migrations/002_reports_table.sql` — `reports` (user_id, keyword, content)
3. (기존에 예전 001을 이미 실행한 경우) `supabase/migrations/003_profiles_simplify_for_supabase_auth.sql` — 불필요 테이블 제거

