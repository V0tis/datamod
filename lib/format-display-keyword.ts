/** UUID (버전 니블 1–5) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * 대시보드·목록에서 잘못 저장된 키워드(예: "분석")·빈 값·UUID 표시용.
 * 실제 검색/링크에는 원본 필드를 쓰고, UI 라벨만 보정합니다.
 */
export function formatDisplayKeyword(raw: string | null | undefined): string {
  const k = (raw ?? '').trim()
  if (!k) return '(키워드 없음)'
  if (k === '분석') return '(키워드 없음)'
  if (UUID_RE.test(k)) return '(키워드 없음)'
  return k
}
