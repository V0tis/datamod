import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/require-auth'

/** Aggregated per-keyword for dashboard (global analysis data). */
export type DashboardKeywordRow = {
  keyword: string
  opportunity_score: number
  risk_score: number
  analysis_count: number
}

export type DashboardRecommendationsResponse = {
  highOpportunity: DashboardKeywordRow[]
  highRisk: DashboardKeywordRow[]
}

const LIMIT_ROWS = 2000
const TOP_N = 5

/**
 * GET: Global dashboard recommendations (all users' analysis data).
 * - High opportunity: top 5 by opportunity_score DESC
 * - High risk: top 5 by risk_score DESC (from strategy_evaluation.competition_risk, scaled 0-100)
 * - analysis_count: number of analyses per keyword
 * Uses 로그인 세션 Supabase 클라이언트. RLS: research_history는 인증 사용자 전체 조회 가능(033).
 * 서비스 롤 불필요 — Vercel에 SUPABASE_SERVICE_ROLE_KEY 없어도 동작.
 */
export async function GET() {
  try {
    const auth = await requireAuth({ body: { highOpportunity: [], highRisk: [] } })
    if ('response' in auth) return auth.response

    const { supabase } = auth
    const { data: rows, error } = await supabase
      .from('research_history')
      .select('keyword, country_code, key_metrics, updated_at')
      .eq('analysis_status', 'completed')
      .not('key_metrics', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(LIMIT_ROWS)

    if (error) {
      return NextResponse.json(
        { highOpportunity: [], highRisk: [], error: error.message },
        { status: 500 }
      )
    }

    type Km = {
      opportunity_score?: number
      strategy_evaluation?: { competition_risk?: number }
    }
    const byKeyword = new Map<string, { opportunity_score: number; risk_score: number; count: number }>()

    for (const r of rows ?? []) {
      const keyword = (r as { keyword?: string }).keyword?.trim()
      if (!keyword) continue
      const km = (r as { key_metrics?: Km }).key_metrics as Km | null
      if (!km || typeof km !== 'object') continue

      const opportunity_score =
        typeof km.opportunity_score === 'number' && km.opportunity_score >= 0 && km.opportunity_score <= 100
          ? km.opportunity_score
          : null
      const competition_risk = km.strategy_evaluation?.competition_risk
      const risk_score =
        typeof competition_risk === 'number' && competition_risk >= 1 && competition_risk <= 10
          ? competition_risk * 10
          : 50

      const existing = byKeyword.get(keyword)
      if (!existing) {
        byKeyword.set(keyword, {
          opportunity_score: opportunity_score ?? 0,
          risk_score,
          count: 1,
        })
      } else {
        existing.count += 1
        if (opportunity_score != null && opportunity_score > existing.opportunity_score) {
          existing.opportunity_score = opportunity_score
        }
        if (risk_score > existing.risk_score) {
          existing.risk_score = risk_score
        }
      }
    }

    const list: DashboardKeywordRow[] = Array.from(byKeyword.entries())
      .filter(([, v]) => v.opportunity_score > 0 || v.risk_score > 0)
      .map(([keyword, v]) => ({
        keyword,
        opportunity_score: v.opportunity_score,
        risk_score: v.risk_score,
        analysis_count: v.count,
      }))

    const highOpportunity = [...list]
      .sort((a, b) => b.opportunity_score - a.opportunity_score)
      .slice(0, TOP_N)
    const highRisk = [...list]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, TOP_N)

    const body: DashboardRecommendationsResponse = {
      highOpportunity,
      highRisk,
    }
    const res = NextResponse.json(body)
    res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120')
    return res
  } catch (e) {
    return NextResponse.json(
      { highOpportunity: [], highRisk: [], error: e instanceof Error ? e.message : 'Failed' },
      { status: 500 }
    )
  }
}
