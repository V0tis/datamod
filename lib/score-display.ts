/**
 * 분석 리포트 점수 체계: 주 점수는 /100, 차원·축 점수는 /10.
 */

/** 기회 점수 등 주 지표 */
export function formatPrimaryScore100(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${Math.round(Math.min(100, Math.max(0, value))).toLocaleString('ko-KR')}/100`
}

/**
 * 기회 점수 breakdown 등에 들어오는 값(0–10 또는 0–100)을 표시용 0–10 정수로 통일.
 * 10 이하이면 이미 /10 스케일로 간주, 그 외는 100 만점으로 보고 /10 환산.
 */
export function breakdownDimensionTo10(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null
  const x = Number(raw)
  if (x <= 10) return Math.min(10, Math.max(0, Math.round(x)))
  if (x <= 100) return Math.min(10, Math.max(0, Math.round(x / 10)))
  return Math.min(10, Math.max(0, Math.round(x / 10)))
}

/** Porter 원점수(통상 1–5) → 화면 /10 (2–10 스텝) */
export function porterFiveScoreTo10(fiveScale: number): number {
  const n = Math.round(Number.isFinite(fiveScale) ? fiveScale : 0)
  const c = Math.min(5, Math.max(0, n))
  return Math.min(10, Math.max(0, Math.round((c / 5) * 10)))
}
