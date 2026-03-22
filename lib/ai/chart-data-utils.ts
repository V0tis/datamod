/**
 * Build chart data from real analysis outputs only.
 * No mock data, no hardcoded values, no placeholders.
 */
import type { ChartData } from '@/lib/research-parser'

export type ChartBreakdown = {
  market_growth?: number
  trend_momentum?: number
  funding_signals?: number
  competition_density?: number
  risk_factors?: number
}

/** Build ChartData from analysis counts and scores. All values derived from real data. */
export function buildChartDataFromAnalysis(
  posCount: number,
  neuCount: number,
  negCount: number,
  marketScore: number,
  breakdown?: ChartBreakdown | null
): ChartData {
  const total = posCount + neuCount + negCount
  const sentiment =
    total > 0
      ? {
          positive: Math.round((posCount / total) * 100),
          neutral: Math.round((neuCount / total) * 100),
          negative: Math.round((negCount / total) * 100),
        }
      : {
          positive: Math.min(100, Math.max(0, marketScore)),
          neutral: 0,
          negative: Math.min(100, Math.max(0, 100 - marketScore)),
        }

  const norm = (v: number) => Math.round(Math.min(10, Math.max(1, 5 + v / 5)))
  const impact: ChartData['impact'] =
    breakdown != null
      ? [
          { subject: '시장 성장', score: norm(breakdown.market_growth ?? 0) },
          { subject: '트렌드', score: norm(breakdown.trend_momentum ?? 0) },
          { subject: '펀딩/기회', score: norm(breakdown.funding_signals ?? 0) },
          { subject: '경쟁', score: norm(breakdown.competition_density ?? 0) },
          { subject: '리스크', score: norm(breakdown.risk_factors ?? 0) },
        ]
      : [
          { subject: '시장 온도', score: Math.min(10, Math.max(1, Math.round(marketScore / 10))) },
          { subject: '긍정 시그널', score: Math.min(10, Math.max(1, posCount + 1)) },
          { subject: '리스크', score: Math.min(10, Math.max(1, negCount + 1)) },
        ]

  return { sentiment, impact }
}
