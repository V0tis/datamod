/**
 * Parse two-pass minimal JSON into full research format.
 * Keeps UI contract unchanged; adapts minimal schema to existing structures.
 * @deprecated Logic has been inlined into lib/ai/runResearch.ts.
 * This file will be removed once all API routes migrate to the new streaming architecture.
 */
import { extractJsonFromText } from '@/lib/extract-json'
import type { InitialResearchSummary, ChartData, StructuredAnalysisFields } from '@/lib/research-parser'

export type Pass1Output = {
  summary: string
  temperature: number
  insights: string[]
}

export type Pass2Output = {
  insights?: { facts?: string[]; hypotheses?: string[]; inferences?: string[] }
  actions?: Array<{ title?: string; reasoning?: string; urgency?: string }>
  signals?: { pos?: string[]; neu?: string[]; neg?: string[] }
}

function parseJson<T>(text: string): T | null {
  const raw = extractJsonFromText(text)
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function parsePass1Response(text: string): Pass1Output | null {
  const p = parseJson<Pass1Output>(text)
  if (!p || typeof p.summary !== 'string') return null
  const temp = typeof p.temperature === 'number' ? Math.min(100, Math.max(0, p.temperature)) : 50
  const insights = Array.isArray(p.insights) ? p.insights.filter((s): s is string => typeof s === 'string').slice(0, 3) : []
  return { summary: p.summary.trim(), temperature: temp, insights }
}

export function parsePass2Response(text: string): Pass2Output | null {
  const p = parseJson<Pass2Output>(text)
  if (!p || typeof p !== 'object') return null
  return p
}

function defaultChartData(): ChartData {
  return {
    sentiment: { positive: 65, neutral: 20, negative: 15 },
    impact: [
      { subject: '경제', score: 5 },
      { subject: '사회', score: 5 },
      { subject: '기술', score: 5 },
      { subject: '정치', score: 5 },
      { subject: '환경', score: 5 },
    ],
  }
}

/** Build InitialResearchSummary from pass1 only (partial). */
export function pass1ToSummary(p1: Pass1Output, articleSummaries: string[] = []): InitialResearchSummary {
  const marketNews = p1.insights.slice(0, 5)
  const keyConclusions = p1.insights.slice(0, 5)
  return {
    marketNews,
    painPoints: [],
    competitorTrends: '',
    sentiment: p1.temperature,
    publicReactionTrends: p1.summary,
    chartData: defaultChartData(),
    articleSummaries,
    keyConclusions,
  }
}

/** Build full StructuredAnalysisFields from pass1 + pass2. */
export function mergePass1Pass2(
  p1: Pass1Output,
  p2: Pass2Output | null
): { summary: InitialResearchSummary; structured: StructuredAnalysisFields } {
  const facts = p2?.insights?.facts ?? []
  const hypotheses = p2?.insights?.hypotheses ?? []
  const inferences = p2?.insights?.inferences ?? []
  const pos = p2?.signals?.pos ?? []
  const neu = p2?.signals?.neu ?? []
  const neg = p2?.signals?.neg ?? []
  const rawActions = p2?.actions ?? []
  const recActions = rawActions
    .filter((a): a is { title: string; reasoning?: string; urgency?: string } => typeof a?.title === 'string')
    .map((a) => ({
      title: a.title,
      reasoning: typeof a.reasoning === 'string' ? a.reasoning : undefined,
      urgency_level: (a.urgency === 'high' || a.urgency === 'medium' || a.urgency === 'low' ? a.urgency : 'low') as 'low' | 'medium' | 'high',
    }))

  const marketNews = [...facts, ...pos].slice(0, 5)
  const painPoints = [...neg, ...hypotheses].filter(Boolean).slice(0, 5)
  const competitorTrends = inferences.find((s) => /경쟁|경쟁사|시장점유/i.test(s)) ?? ''
  const keyConclusions = [...recActions.map((a) => a.title), ...inferences].filter(Boolean).slice(0, 5)
  const publicReactionTrends = [...pos, ...neu, ...neg].join('. ').slice(0, 500)

  const summary: InitialResearchSummary = {
    marketNews,
    painPoints,
    competitorTrends,
    sentiment: p1.temperature,
    publicReactionTrends,
    chartData: defaultChartData(),
    articleSummaries: [],
    keyConclusions,
  }

  const structured: StructuredAnalysisFields = {
    market_temperature_score: p1.temperature,
    summary_insights: p1.summary,
    facts: facts.length ? facts : p1.insights,
    hypotheses: hypotheses.length ? hypotheses : undefined,
    inferences: inferences.length ? inferences : undefined,
    positive_signals: pos.length ? pos : undefined,
    neutral_signals: neu.length ? neu : undefined,
    negative_risks: neg.length ? neg : undefined,
    pm_actions: {
      recommended_actions: recActions.length ? recActions : [],
      monitoring_points: [],
      decision_risks: [],
    },
  }

  return { summary, structured }
}
