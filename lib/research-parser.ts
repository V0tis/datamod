/**
 * Single responsibility: parse and normalize initial research JSON from AI responses.
 * Supports PM analysis schema (new) and legacy format for backward compatibility.
 * @deprecated Types are used by lib/ai/runResearch.ts. Parsing logic has been inlined.
 * This file will be removed once all API routes migrate to the new streaming architecture.
 */
import { safeParseAiJson } from '@/lib/ai/safe-json-parse'
import type { PMAnalysisOutput, RecommendedAction } from '@/lib/ai/pm-analysis-schema'
import { pmAnalysisToInitialSummary } from '@/lib/ai/pm-analysis-adapter'

export type ChartSentiment = { positive: number; neutral: number; negative: number }
export type ChartImpactItem = { subject: string; score: number }
export type ChartData = { sentiment: ChartSentiment; impact: ChartImpactItem[] }

export type InitialResearchSummary = {
  marketNews: string[]
  painPoints: string[]
  competitorTrends: string
  sentiment: number
  publicReactionTrends: string
  chartData: ChartData
  articleSummaries: string[]
  keyConclusions: string[]
}

/** Structured recommended action for PM layer. */
export type StructuredRecommendedAction = {
  title: string
  reasoning?: string
  urgency_level?: 'low' | 'medium' | 'high'
  related_risk?: string
}

/** PM Action Plan item – actionable output for product strategy. */
export type PMActionPlanItem = {
  action_title: string
  description?: string
  expected_outcome?: string
  priority?: 'high' | 'medium' | 'low'
  category?: 'mvp_experiment' | 'user_interview' | 'feature_prioritization' | 'go_to_market'
}

/** Structured PM analysis fields for DB persistence and frontend parsing. */
export type StructuredAnalysisFields = {
  analysis_target?: string
  confidence_score?: number
  market_temperature_score?: number
  facts?: string[]
  hypotheses?: string[]
  inferences?: string[]
  positive_signals?: string[]
  neutral_signals?: string[]
  negative_risks?: string[]
  summary_insights?: string
  pm_actions?: {
    recommended_actions?: StructuredRecommendedAction[]
    monitoring_points?: string[]
    decision_risks?: string[]
  }
  competitive_landscape?: Array<{
    name?: string
    positioning?: string
    target_market?: string
    key_feature?: string
    pricing?: string
    differentiation?: string
    strength?: string
    weakness?: string
  }>
  market_structure?: { competition_density?: string; summary?: string }
  market_phase?: string
  /** Opportunity Score (0-100) - PM market attractiveness */
  opportunity_score?: number
  opportunity_score_breakdown?: {
    market_growth?: number
    competition_density?: number
    trend_momentum?: number
    funding_signals?: number
    risk_factors?: number
    /** Legacy 0-100 format */
    competition_pressure?: number
    user_demand?: number
    product_differentiation?: number
    market_timing?: number
  }
  opportunity_score_reasoning?: string
  strategic_actions?: {
    immediate?: Array<{ action?: string; priority?: string; expected_impact?: string }>
    mid_term?: Array<{ action?: string; priority?: string; expected_impact?: string }>
    risk_mitigation?: Array<{ action?: string; priority?: string; risk_addressed?: string }>
  }
  /** Strategy Evaluation - AI-scored dimensions 1-10 */
  strategy_evaluation?: {
    market_attractiveness?: number
    competition_risk?: number
    execution_difficulty?: number
    growth_potential?: number
  }
  /** Product strategy focus: short market summary */
  market_summary?: string
  /** 3–5 key strategic insights */
  key_strategic_insights?: string[]
  /** Opportunity areas (from opportunities) */
  opportunity_areas?: string[]
  /** Recommended product strategy: product idea, target customer, monetization */
  recommended_product_strategy?: {
    summary?: string
    product_idea?: string
    target_customer?: string
    monetization?: string
  }
  /** PM Action Plan – concrete actions with title, description, expected_outcome, priority */
  pm_action_plan?: PMActionPlanItem[]
    /** Chart insights – AI-generated interpretation per chart */
    chart_insights?: {
      search_trend?: { insight?: string; takeaway?: string }
      market_size?: { insight?: string; takeaway?: string }
      adoption_rate?: { insight?: string; takeaway?: string }
      score_distribution?: { insight?: string; takeaway?: string }
    }
    /** Next Actions for PM – 5 actionable steps with why, how, priority, effort */
    next_actions_pm?: Array<{
      action?: string
      why?: string
      how_to_execute?: string
      priority?: 'high' | 'medium' | 'low'
      estimated_effort?: string
    }>
    /** Strategic Decision Layer – market opportunity, competition, PMF, entry timing with AI explanations */
    strategic_decision_layer?: {
    market_opportunity_explanation?: string
    competition_intensity?: 'low' | 'medium' | 'high'
    competition_explanation?: string
    product_market_fit?: 'low' | 'medium' | 'high'
    product_market_fit_explanation?: string
    entry_strategy?: string
    entry_explanation?: string
  }
  /** Product strategy frameworks: concise bullet insights */
  swot_analysis?: {
    strengths?: string[]
    weaknesses?: string[]
    opportunities?: string[]
    threats?: string[]
  }
  jtbd?: {
    main_jobs?: string[]
    pains?: string[]
    gains?: string[]
  }
  porter_5_forces?: {
    rivalry?: string[]
    supplier_power?: string[]
    buyer_power?: string[]
    substitutes?: string[]
    new_entrants?: string[]
  }
}

const DEFAULT_CHART_SENTIMENT: ChartSentiment = { positive: 65, neutral: 20, negative: 15 }
const DEFAULT_IMPACT: ChartImpactItem[] = [
  { subject: '경제', score: 5 },
  { subject: '사회', score: 5 },
  { subject: '기술', score: 5 },
  { subject: '정치', score: 5 },
  { subject: '환경', score: 5 },
]

/** Normalize to 0–100 and scale so positive+neutral+negative = 100. */
function normalizeChartSentiment(sd: { positive?: number; neutral?: number; negative?: number } | undefined): ChartSentiment {
  const positive = Math.min(100, Math.max(0, typeof sd?.positive === 'number' ? sd.positive : 65))
  const neutral = Math.min(100, Math.max(0, typeof sd?.neutral === 'number' ? sd.neutral : 20))
  const negative = Math.min(100, Math.max(0, typeof sd?.negative === 'number' ? sd.negative : 15))
  const sum = positive + neutral + negative
  if (sum <= 0) return DEFAULT_CHART_SENTIMENT
  return {
    positive: Math.round((positive / sum) * 100),
    neutral: Math.round((neutral / sum) * 100),
    negative: Math.round((negative / sum) * 100),
  }
}

/** Keep only valid subject+score; clamp score 0–10; max 8 items; fallback to DEFAULT_IMPACT if empty. */
function normalizeChartImpact(raw: Array<{ subject?: string; score?: number }> | undefined): ChartImpactItem[] {
  const list = Array.isArray(raw) ? raw : []
  const impactList = list
    .filter((i): i is { subject: string; score: number } => typeof i?.subject === 'string' && typeof i?.score === 'number')
    .map((i) => ({ subject: i.subject, score: Math.min(10, Math.max(0, i.score)) }))
    .slice(0, 8)
  return impactList.length > 0 ? impactList : DEFAULT_IMPACT
}

function isPmAnalysisOutput(o: unknown): o is PMAnalysisOutput {
  if (!o || typeof o !== 'object') return false
  const p = o as Record<string, unknown>
  return (
    p.meta != null &&
    typeof p.meta === 'object' &&
    p.market_temperature != null &&
    typeof p.market_temperature === 'object' &&
    p.insights != null &&
    typeof p.insights === 'object' &&
    p.pm_actions != null &&
    typeof p.pm_actions === 'object'
  )
}

/**
 * Parse AI response text into normalized InitialResearchSummary.
 * Accepts PM analysis schema (preferred) or legacy format.
 * Validates and parses JSON safely; never throws.
 */
export function parseInitialResearchResponse(
  responseText: string,
  options?: { repair?: boolean; articleSummaries?: string[] }
): { ok: true; summary: InitialResearchSummary; structured?: StructuredAnalysisFields } | { ok: false; error: string } {
  const result = safeParseAiJson<Record<string, unknown>>(responseText, {
    fallback: {},
    repair: options?.repair ?? true,
    logFailures: false,
    context: 'parseInitialResearchResponse',
  })
  if (!result.ok) return { ok: false, error: '분석 결과 형식이 올바르지 않아요.' }
  const parsed = result.data

  if (isPmAnalysisOutput(parsed)) {
    const summary = pmAnalysisToInitialSummary(parsed, options?.articleSummaries ?? [])
    const pm = parsed as PMAnalysisOutput
    const exp = pm.market_temperature?.explanation ?? { positive_signals: [], neutral_signals: [], negative_risks: [] }
    const structured: StructuredAnalysisFields = {
      analysis_target: (pm.meta?.analysis_target as string) ?? undefined,
      confidence_score: typeof pm.meta?.confidence_score === 'number' ? pm.meta.confidence_score : undefined,
      market_temperature_score: typeof pm.market_temperature?.score === 'number' ? pm.market_temperature.score : undefined,
      facts: Array.isArray(pm.insights?.facts) ? pm.insights.facts : undefined,
      hypotheses: Array.isArray(pm.insights?.hypotheses) ? pm.insights.hypotheses : undefined,
      inferences: Array.isArray(pm.insights?.inferences) ? pm.insights.inferences : undefined,
      positive_signals: Array.isArray(exp.positive_signals) ? exp.positive_signals : undefined,
      neutral_signals: Array.isArray(exp.neutral_signals) ? exp.neutral_signals : undefined,
      negative_risks: Array.isArray(exp.negative_risks) ? exp.negative_risks : undefined,
      summary_insights: [pm.insights?.facts, pm.insights?.inferences]
        .flat()
        .filter(Boolean)
        .join('. ')
        .slice(0, 500) || undefined,
      pm_actions: (() => {
        const pa = pm.pm_actions
        if (!pa) return undefined
        const rawRec = pa.recommended_actions ?? []
        const normalized = rawRec
          .map((a) => {
            if (typeof a === 'object' && a != null && typeof (a as RecommendedAction).title === 'string') {
              const r = a as RecommendedAction
              return {
                title: r.title,
                reasoning: typeof r.reasoning === 'string' ? r.reasoning : undefined,
                urgency_level: r.urgency_level === 'low' || r.urgency_level === 'medium' || r.urgency_level === 'high' ? r.urgency_level : undefined,
                related_risk: typeof r.related_risk === 'string' ? r.related_risk : undefined,
              }
            }
            if (typeof a === 'string' && a.trim()) return { title: a.trim() }
            return null
          })
          .filter((x): x is NonNullable<typeof x> => x != null)
        return {
          recommended_actions: normalized,
          monitoring_points: Array.isArray(pa.monitoring_points) ? pa.monitoring_points.filter((s): s is string => typeof s === 'string') : undefined,
          decision_risks: Array.isArray(pa.decision_risks) ? pa.decision_risks.filter((s): s is string => typeof s === 'string') : undefined,
        }
      })(),
    }
    return { ok: true, summary, structured }
  }

  const legacy = parsed as {
    marketNews?: string[]
    painPoints?: string[]
    competitorTrends?: string
    sentiment?: number
    publicReactionTrends?: string
    chartData?: { sentiment?: ChartSentiment; impact?: ChartImpactItem[] }
    articleSummaries?: string[]
    keyConclusions?: string[]
  }

  const sentiment =
    typeof legacy.sentiment === 'number' ? Math.min(100, Math.max(0, legacy.sentiment)) : 0
  const chartSentiment = normalizeChartSentiment(legacy.chartData?.sentiment)
  const chartImpact = normalizeChartImpact(legacy.chartData?.impact)
  const chartData: ChartData = { sentiment: chartSentiment, impact: chartImpact }

  const articleSummaries = Array.isArray(legacy.articleSummaries)
    ? legacy.articleSummaries.filter((s): s is string => typeof s === 'string')
    : []
  const keyConclusions = Array.isArray(legacy.keyConclusions)
    ? legacy.keyConclusions.filter((s): s is string => typeof s === 'string').slice(0, 3)
    : (Array.isArray(legacy.marketNews) ? legacy.marketNews : []).slice(0, 3)

  const summary: InitialResearchSummary = {
    marketNews: Array.isArray(legacy.marketNews) ? legacy.marketNews : [],
    painPoints: Array.isArray(legacy.painPoints) ? legacy.painPoints : [],
    competitorTrends: typeof legacy.competitorTrends === 'string' ? legacy.competitorTrends : '',
    sentiment,
    publicReactionTrends: typeof legacy.publicReactionTrends === 'string' ? legacy.publicReactionTrends : '',
    chartData,
    articleSummaries,
    keyConclusions,
  }

  return { ok: true, summary }
}
