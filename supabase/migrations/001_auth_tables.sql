-- Rin-AI 인증용 테이블 (Supabase Auth 사용 시 profiles는 id, email만 보관)
-- Supabase SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

COMMENT ON TABLE profiles IS 'Supabase Auth 사용자와 1:1 매칭, id=auth.users.id';
