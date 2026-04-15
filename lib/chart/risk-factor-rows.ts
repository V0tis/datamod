import { breakdownToRadarDisplayRows, type RadarRow } from '@/lib/chart/opportunity-radar-display'

const RISK_KEY_HINT = new Set([
  'risk_factors',
  'competition_density',
  'competition_pressure',
  'market_timing',
])

/**
 * 리스크 막대용: 최대 5개 축을 위험도(표시 점수) 높은 순으로 정렬.
 * breakdown에 리스크·경쟁 축이 있으면 우선하고, 없으면 전체 축 중 상위를 사용합니다.
 */
export function topRiskFactorRows(
  breakdown: Record<string, number | undefined> | null | undefined,
  opportunityScore: number
): { label: string; value: number; fullMark: number }[] {
  if (!breakdown || Object.keys(breakdown).length === 0) {
    const s = Math.min(100, Math.max(0, Math.round(opportunityScore)))
    return [
      { label: '리스크 요인', value: Math.round((100 - s) * 0.85), fullMark: 100 },
      { label: '경쟁 압력', value: Math.round((100 - s) * 0.7), fullMark: 100 },
      { label: '시장 타이밍', value: Math.round(s * 0.35), fullMark: 100 },
      { label: '수요 변동', value: Math.round((100 - s) * 0.5), fullMark: 100 },
      { label: '자금·신호', value: Math.round(s * 0.4), fullMark: 100 },
    ].sort((a, b) => b.value - a.value)
  }

  const all = breakdownToRadarDisplayRows(breakdown, { maxAxes: 12 })
  const preferred = all.filter((r) => r.key && RISK_KEY_HINT.has(r.key))
  const pool: RadarRow[] = preferred.length >= 2 ? preferred : all
  const sorted = [...pool].sort((a, b) => b.score - a.score).slice(0, 5)

  return sorted.map((r) => ({ label: r.subject, value: r.score, fullMark: r.fullMark }))
}
