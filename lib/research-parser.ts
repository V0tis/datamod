/**
 * Single responsibility: parse and normalize initial research JSON from AI responses.
 * Supports PM analysis schema (new) and legacy format for backward compatibility.
 */
import { extractJsonFromText, tryRepairTruncatedJson } from '@/lib/extract-json'
import type { PMAnalysisOutput } from '@/lib/ai/pm-analysis-schema'
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
 * Uses extractJsonFromText; options.repair tries to fix truncated JSON.
 */
export function parseInitialResearchResponse(
  responseText: string,
  options?: { repair?: boolean; articleSummaries?: string[] }
): { ok: true; summary: InitialResearchSummary } | { ok: false; error: string } {
  let rawJson = extractJsonFromText(responseText)
  let parsed: unknown

  try {
    parsed = JSON.parse(rawJson)
  } catch (parseErr) {
    if (options?.repair) {
      const err = parseErr instanceof Error ? parseErr : new Error(String(parseErr))
      const repaired = tryRepairTruncatedJson(rawJson, err)
      if (repaired) {
        try {
          parsed = JSON.parse(repaired)
        } catch {
          return { ok: false, error: '분석 결과 형식이 올바르지 않아요.' }
        }
      } else {
        return { ok: false, error: '분석 결과 형식이 올바르지 않아요.' }
      }
    } else {
      return { ok: false, error: '분석 결과 형식이 올바르지 않아요.' }
    }
  }

  if (isPmAnalysisOutput(parsed)) {
    const summary = pmAnalysisToInitialSummary(parsed, options?.articleSummaries ?? [])
    return { ok: true, summary }
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
