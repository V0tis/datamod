-- profiles 테이블에 nickname 컬럼 추가 (회원가입/설정에서 사용)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nickname TEXT;
COMMENT ON COLUMN profiles.nickname IS '사용자 닉네임, 사이드바 등 표시용';

-- RLS: 본인 프로필만 읽기/수정
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
