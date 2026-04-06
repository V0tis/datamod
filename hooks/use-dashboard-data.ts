import { useMemo } from 'react'
import type { DashboardKeywordRow } from '@/app/api/research/dashboard-recommendations/route'

/**
 * 히어로 부제·배지에 쓰는 고기회/고리스크 건수 (코호트 데이터 기반).
 */
export function useDashboardSignalCounts(
  highOpportunity: DashboardKeywordRow[],
  highRisk: DashboardKeywordRow[]
) {
  return useMemo(() => {
    const oStrong = highOpportunity.filter((x) => x.opportunity_score >= 62).length
    const rStrong = highRisk.filter((x) => x.risk_score >= 62).length
    return {
      strongOppCount: oStrong > 0 ? oStrong : highOpportunity.length,
      strongRiskCount: rStrong > 0 ? rStrong : highRisk.length,
    }
  }, [highOpportunity, highRisk])
}
