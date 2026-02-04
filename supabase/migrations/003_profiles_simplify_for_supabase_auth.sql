-- 기존 001을 이미 실행한 경우: profiles를 id+email만 남기고, one_time_tokens 제거
-- 새로 설치한 경우 001만 실행하면 되므로 이 파일은 실행하지 않아도 됨

-- one_time_tokens 테이블 제거 (Supabase Auth 이메일 인증 사용)
DROP TABLE IF EXISTS one_time_tokens;

-- profiles에서 Supabase Auth에 맞지 않는 컬럼 제거 (있을 경우만)
ALTER TABLE profiles DROP COLUMN IF EXISTS password_hash;
ALTER TABLE profiles DROP COLUMN IF EXISTS status;
ALTER TABLE profiles DROP COLUMN IF EXISTS otp_code;
ALTER TABLE profiles DROP COLUMN IF EXISTS otp_expires_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS updated_at;
ALTER TABLE profiles DROP COLUMN IF EXISTS created_at;

-- id를 auth.users(id) 참조로 변경 (기존 id 유지하려면 먼저 auth.users와 매칭 필요)
-- 기존 데이터가 auth.users와 다르다면, 이 마이그레이션 전에 데이터 이전이 필요할 수 있음
-- 새 설치가 아니라면 아래 FK 추가는 제외하고, id/email만 유지하는 것으로 충분할 수 있음
-- ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
