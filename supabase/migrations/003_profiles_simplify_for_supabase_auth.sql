-- 기존 001을 이미 실행한 경우: auth_users → profiles(id, email만), one_time_tokens 제거
-- 새로 설치한 경우 001만 실행하면 되므로 이 파일은 실행하지 않아도 됨

DROP TABLE IF EXISTS one_time_tokens;

-- auth_users가 있으면 profiles로 전환 (기존 데이터가 있다면 수동 마이그레이션 필요)
-- 새 설치 시에는 001만 사용하므로 아래는 참고용
-- DROP TABLE IF EXISTS auth_users;
-- 이후 001의 profiles 생성
