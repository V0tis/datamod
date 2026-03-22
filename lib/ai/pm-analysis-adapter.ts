/**
 * Adapters: PMAnalysisOutput -> legacy formats.
 * pmAnalysisToConsensus lives in consensusService to avoid circular deps.
 * All chart data derived from real analysis outputs only.
 */
import type { PMAnalysisOutput, RecommendedAction } from './pm-analysis-schema'
import type { InitialResearchSummary } from '@/lib/research-parser'
import { buildChartDataFromAnalysis } from './chart-data-utils'

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

  const posCount = (exp.positive_signals ?? []).length
  const neuCount = (exp.neutral_signals ?? []).length
  const negCount = (exp.negative_risks ?? []).length
  const chartData = buildChartDataFromAnalysis(posCount, neuCount, negCount, sentiment)

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

