import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/require-auth'
import type { DashboardKeywordRow } from '@/lib/types/dashboard-keyword-row'

/** @deprecated 코호트 집계는 제거됨. 호환을 위해 빈 배열만 반환합니다. */
export type { DashboardKeywordRow }

export type DashboardRecommendationsResponse = {
  highOpportunity: DashboardKeywordRow[]
  highRisk: DashboardKeywordRow[]
}

/**
 * GET: 과거에는 research_history를 집계해 상위 키워드를 반환했으나,
 * 인사이트 제안은 **현재 분석 컨텍스트** 기반 API(`/api/research/insight-suggestion`)로 이전했습니다.
 */
export async function GET() {
  try {
    const auth = await requireAuth({ body: { highOpportunity: [], highRisk: [] } })
    if ('response' in auth) return auth.response

    const body: DashboardRecommendationsResponse = {
      highOpportunity: [],
      highRisk: [],
    }
    const res = NextResponse.json(body)
    res.headers.set('Cache-Control', 'private, max-age=0')
    return res
  } catch (e) {
    return NextResponse.json(
      { highOpportunity: [], highRisk: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
