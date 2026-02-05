-- 공유 링크용: share_token(고유), shared_at
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ;

COMMENT ON COLUMN reports.share_token IS '공유 URL에 사용되는 고유 토큰 (예: /share/xxx)';
COMMENT ON COLUMN reports.shared_at IS '공유 활성화 시각';

-- 공개 조회용: share_token으로 리포트 조회 허용 (RLS는 API에서 서버로 조회 시 적용)
-- 인증 없이 share_token만 알면 읽기 가능하므로, 토큰은 예측 불가능한 랜덤 값 사용 권장
