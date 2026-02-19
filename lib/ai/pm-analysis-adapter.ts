/**
 * Adapters: PMAnalysisOutput -> legacy formats.
 * pmAnalysisToConsensus lives in consensusService to avoid circular deps.
 */
import type { PMAnalysisOutput, TrendValue, RecommendedAction } from './pm-analysis-schema'
import type { InitialResearchSummary, ChartData } from '@/lib/research-parser'

function trendToSentimentRatio(trend: TrendValue, score: number): { positive: number; neutral: number; negative: number } {
  const s = Math.min(100, Math.max(0, score))
  if (trend === 'rising') return { positive: Math.min(100, s + 20), neutral: 20, negative: Math.max(0, 80 - s) }
  if (trend === 'declining') return { positive: Math.max(0, s - 20), neutral: 20, negative: Math.min(100, 100 - s + 20) }
  return {
    positive: Math.round(s * 0.5),
    neutral: Math.round((100 - s) * 0.3),
    negative: Math.round((100 - s) * 0.7),
  }
}

/** Map PMAnalysisOutput to InitialResearchSummary for reports/research_history. */
export function pmAnalysisToInitialSummary(
  pm: PMAnalysisOutput,
  articleSummaries: string[] = []
): InitialResearchSummary {
  const { market_temperature, insights, pm_actions } = pm
  const exp = market_temperature?.explanation ?? {
    positive_signals: [] as string[],
    neutral_signals: [] as string[],
    negative_risks: [] as string[],
  }
  const facts = insights?.facts ?? []
  const inferences = insights?.inferences ?? []
  const hypotheses = insights?.hypotheses ?? []
  const rawRecActions = pm_actions?.recommended_actions ?? []
  const recActions: string[] = rawRecActions.map((a) =>
    typeof a === 'object' && a != null && typeof (a as RecommendedAction).title === 'string'
      ? (a as RecommendedAction).title
      : typeof a === 'string'
        ? a
        : ''
  ).filter(Boolean)

  const marketNews = [...facts, ...(exp.positive_signals ?? [])].slice(0, 5)
  const painPoints = [...(exp.negative_risks ?? []), ...hypotheses].filter(Boolean).slice(0, 5)
  const competitorTrends = inferences.find((s) => /경쟁|경쟁사|시장점유/i.test(s)) ?? ''
  const sentiment = Math.min(100, Math.max(0, market_temperature?.score ?? 50))
  const publicReactionTrends = [...(exp.positive_signals ?? []), ...(exp.neutral_signals ?? []), ...(exp.negative_risks ?? [])].join('. ').slice(0, 500)

  const trend = (market_temperature?.trend ?? 'stable') as TrendValue
  const ratio = trendToSentimentRatio(trend, market_temperature?.score ?? 50)
  const sum = ratio.positive + ratio.neutral + ratio.negative
  const chartSentiment = sum > 0
    ? {
        positive: Math.round((ratio.positive / sum) * 100),
        neutral: Math.round((ratio.neutral / sum) * 100),
        negative: Math.round((ratio.negative / sum) * 100),
      }
    : { positive: 65, neutral: 20, negative: 15 }
  const chartData: ChartData = {
    sentiment: chartSentiment,
    impact: [
      { subject: '경제', score: 5 },
      { subject: '사회', score: 5 },
      { subject: '기술', score: 5 },
      { subject: '정치', score: 5 },
      { subject: '환경', score: 5 },
    ],
  }

  const keyConclusions = [...recActions, ...inferences].slice(0, 5)

  return {
    marketNews,
    painPoints,
    competitorTrends,
    sentiment,
    publicReactionTrends,
    chartData,
    articleSummaries,
    keyConclusions,
  }
}

