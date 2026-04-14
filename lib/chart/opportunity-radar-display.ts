/**
 * 레이더 차트용: 파이프라인 breakdown(수식 축)을 0~100 표시 스케일로 환산한다.
 * 음수 축(경쟁·리스크)을 0으로만 두면 차트가 바닥에 붙어 보이므로 별도 매핑한다.
 */

export const OPPORTUNITY_RADAR_LABELS: Record<string, string> = {
  market_growth: '시장 성장',
  trend_momentum: '트렌드',
  competition_density: '경쟁 밀도',
  competition_pressure: '경쟁 압력',
  funding_signals: '투자 신호',
  risk_factors: '리스크 요인',
  user_demand: '수요',
  product_differentiation: '차별화',
  market_timing: '타이밍',
}

const DISPLAY_FLOOR = 10

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** null/undefined → 제외. 0 또는 환산 후 0 → 바닥 10으로 보정(요구사항). */
export function breakdownValueToRadarDisplay(key: string, v: number): number | null {
  if (!Number.isFinite(v)) return null

  let out: number
  switch (key) {
    case 'market_growth':
      if (v >= -35 && v <= 35) {
        out = clamp(50 + v * 2.25, 5, 95)
      } else {
        out = clamp(v, 0, 100)
      }
      break
    case 'trend_momentum':
      if (v >= 0 && v <= 30) {
        out = clamp((v / 22) * 100, 0, 100)
      } else {
        out = clamp(v, 0, 100)
      }
      break
    case 'funding_signals':
      if (v >= 0 && v <= 20) {
        out = clamp((v / 15) * 100, 0, 100)
      } else {
        out = clamp(v, 0, 100)
      }
      break
    case 'competition_density':
    case 'risk_factors':
      if (v <= 0 && v >= -35) {
        out = clamp((-v / 25) * 100, 0, 100)
      } else {
        out = clamp(v, 0, 100)
      }
      break
    default:
      out = clamp(v, 0, 100)
  }

  if (out < 1) return DISPLAY_FLOOR
  return Math.round(out)
}

export type RadarRow = { subject: string; score: number; fullMark: number; key?: string }

/**
 * breakdown 항목을 레이더 행으로 변환. 값이 null/undefined인 키는 제외한다.
 */
export function breakdownToRadarDisplayRows(
  breakdown: Record<string, number | undefined | null> | null | undefined,
  options?: { maxAxes?: number }
): RadarRow[] {
  const maxAxes = options?.maxAxes ?? 8
  if (!breakdown || typeof breakdown !== 'object') return []

  const rows: RadarRow[] = []
  for (const [k, raw] of Object.entries(breakdown)) {
    if (raw == null || raw === undefined) continue
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const display = breakdownValueToRadarDisplay(k, raw)
    if (display == null) continue
    rows.push({
      subject: OPPORTUNITY_RADAR_LABELS[k] ?? k,
      score: display,
      fullMark: 100,
      key: k,
    })
    if (rows.length >= maxAxes) break
  }
  return rows
}
