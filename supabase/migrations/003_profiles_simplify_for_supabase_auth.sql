-- 기존 001을 이미 실행한 경우: auth_users/one_time_tokens 제거용 (참고)
-- 새로 설치한 경우 001만 실행하면 되므로 이 파일은 실행하지 않아도 됨

DROP TABLE IF EXISTS one_time_tokens;
