-- Rin-AI 인증용 테이블 (Supabase SQL Editor에서 실행)
-- Table: auth_users (이메일/비밀번호 + 인증 대기·인증됨 상태)
CREATE TABLE IF NOT EXISTS auth_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (status IN ('pending_verification', 'verified')),
  otp_code TEXT,
  otp_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_status ON auth_users(status);

-- Table: one_time_tokens (OTP 인증 후 일회용 로그인 토큰)
CREATE TABLE IF NOT EXISTS one_time_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_one_time_tokens_email ON one_time_tokens(email);
CREATE INDEX IF NOT EXISTS idx_one_time_tokens_token ON one_time_tokens(token);

-- RLS (서버에서 SERVICE_ROLE_KEY 사용 시 불필요. Anon만 쓸 경우 아래 정책 필요)
-- ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE one_time_tokens ENABLE ROW LEVEL SECURITY;
