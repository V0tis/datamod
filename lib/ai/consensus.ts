/**
 * Consensus types and utilities for PM-oriented analysis synthesis.
 * Migrated from services/ai/consensusService.ts for unified AI layer.
 */
import { logger } from '@/lib/logger'
import { CONSENSUS_SYNTHESIS_SYSTEM } from './pm-analysis-prompts'
import type { PMAnalysisOutput, TrendValue, RecommendedAction } from './pm-analysis-schema'

export type ConsensusImpactItem = { subject: string; score: number; reason?: string }
export type ConsensusSentiment = {
  score: number
  trend?: 'rising' | 'falling' | 'stable'
  ratio?: { positive?: number; neutral?: number; negative?: number }
}
export type ConsensusStrategicSummary = {
  summary: string
  opportunity?: string
  threat?: string
  actionItems?: string[]
}
export type ConsensusMetadata = { confidence: number; dataPeriod?: string }

export type Consensus = {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment: ConsensusSentiment
  impactAnalysis?: ConsensusImpactItem[]
  strategicSummary: ConsensusStrategicSummary
  metadata: ConsensusMetadata
}

const CONSENSUS_USER_PREFIX = '--- Gemini 분석 ---\n'
const CONSENSUS_USER_SUFFIX = '\n\n--- Groq 분석 ---\n'

const CONSENSUS_SYSTEM = `${CONSENSUS_SYNTHESIS_SYSTEM}

[Gemini 분석]과 [Groq 분석] 블록에 실제로 적힌 문장만 근거로 삼아 JSON을 채운다.
채울 것: facts 3~5, hypotheses 0~3, inferences 2~4. recommended_actions 2~4개 객체, 각 { title, reasoning, urgency_level: low|medium|high, related_risk? }. meta.confidence_score는 두 분석의 정합성 0~100, meta.generated_at은 현재 시각 ISO 8601.`

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

function trendToSentimentRatio(
  trend: TrendValue,
  score: number
): { positive: number; neutral: number; negative: number } {
  const s = Math.min(100, Math.max(0, score))
  if (trend === 'rising')
    return { positive: Math.min(100, s + 20), neutral: 20, negative: Math.max(0, 80 - s) }
  if (trend === 'declining')
    return { positive: Math.max(0, s - 20), neutral: 20, negative: Math.min(100, 100 - s + 20) }
  return {
    positive: Math.round(s * 0.5),
    neutral: Math.round((100 - s) * 0.3),
    negative: Math.round((100 - s) * 0.7),
  }
}

function pmAnalysisToConsensus(pm: PMAnalysisOutput): Consensus {
  const { meta, market_temperature, insights, pm_actions } = pm
  const exp = market_temperature.explanation
  const score100 = Math.min(100, Math.max(0, market_temperature.score))
  const sentimentScore = score100 * 2 - 100
  const ratio = trendToSentimentRatio(market_temperature.trend, market_temperature.score)
  const sum = ratio.positive + ratio.neutral + ratio.negative
  const normRatio =
    sum > 0
      ? {
          positive: Math.round((ratio.positive / sum) * 100),
          neutral: Math.round((ratio.neutral / sum) * 100),
          negative: Math.round((ratio.negative / sum) * 100),
        }
      : undefined
  const trendMap = {
    rising: 'rising' as const,
    stable: 'stable' as const,
    declining: 'falling' as const,
  }
  return {
    marketNews: insights.facts?.slice(0, 5) ?? [],
    painPoints: exp.negative_risks?.slice(0, 5) ?? [],
    competitorTrends: insights.inferences?.[0] ?? '',
    sentiment: {
      score: sentimentScore,
      trend: trendMap[market_temperature.trend] ?? 'stable',
      ratio: normRatio,
    },
    impactAnalysis: (() => {
      const posCount = exp.positive_signals?.length ?? 0
      const neuCount = exp.neutral_signals?.length ?? 0
      const negCount = exp.negative_risks?.length ?? 0
      const infCount = insights.inferences?.length ?? 0
      const base = Math.min(10, Math.max(1, Math.round(score100 / 10)))
      return [
        { subject: '시장성', score: Math.min(10, Math.max(1, base + (posCount > 0 ? 1 : 0))), reason: exp.positive_signals?.[0] ?? '—' },
        { subject: '기술성', score: base, reason: exp.neutral_signals?.[0] ?? '—' },
        { subject: '반응성', score: Math.min(10, Math.max(1, base - (negCount > 0 ? 1 : 0))), reason: exp.negative_risks?.[0] ?? '—' },
        { subject: '규제/환경', score: base, reason: insights.hypotheses?.[0] ?? '—' },
        { subject: '경쟁력', score: Math.min(10, Math.max(1, base + (infCount > 0 ? 1 : 0))), reason: insights.inferences?.[0] ?? '—' },
      ]
    })(),
    strategicSummary: {
      summary: insights.inferences?.join(' ').slice(0, 500) ?? '',
      opportunity: exp.positive_signals?.join(' ').slice(0, 300) ?? '—',
      threat: exp.negative_risks?.join(' ').slice(0, 300) ?? '—',
      actionItems: (pm_actions.recommended_actions ?? [])
        .slice(0, 5)
        .map((a) =>
          typeof a === 'object' && a != null && typeof (a as RecommendedAction).title === 'string'
            ? (a as RecommendedAction).title
            : typeof a === 'string'
              ? a
              : ''
        )
        .filter(Boolean),
    },
    metadata: { confidence: meta.confidence_score, dataPeriod: '최근 24시간' },
  }
}

function legacyToConsensus(o: Record<string, unknown>): Consensus {
  const summary =
    typeof o.summary === 'string'
      ? o.summary.trim().slice(0, 500)
      : '분석 불가. 데이터가 부족합니다.'
  const sentimentScore =
    typeof o.sentiment === 'number' ? Math.max(-100, Math.min(100, o.sentiment)) : 0
  const confidence =
    typeof o.confidence === 'number' ? Math.max(0, Math.min(100, o.confidence)) : 0
  const action_item = o.action_item
  const actionItems = Array.isArray(action_item)
    ? (action_item as string[]).filter((s): s is string => typeof s === 'string').slice(0, 5)
    : typeof action_item === 'string' && action_item !== '—'
      ? [action_item.trim()].filter(Boolean)
      : []
  const isFallback = summary === '분석 불가. 데이터가 부족합니다.'
  return {
    marketNews: [],
    painPoints: [],
    competitorTrends: '',
    sentiment: { score: sentimentScore, trend: 'stable', ratio: { positive: 0, neutral: 0, negative: 0 } },
    impactAnalysis: isFallback
      ? [] /* No fake data when parse failed */
      : (() => {
          const s = Math.min(10, Math.max(1, Math.round((sentimentScore + 100) / 20)))
          return [
            { subject: '시장성', score: s, reason: '—' },
            { subject: '기술성', score: s, reason: '—' },
            { subject: '반응성', score: s, reason: '—' },
            { subject: '규제/환경', score: s, reason: '—' },
            { subject: '경쟁력', score: s, reason: '—' },
          ]
        })(),
    strategicSummary: {
      summary,
      opportunity:
        typeof o.strategic_insight === 'string' ? o.strategic_insight.trim().slice(0, 300) : '—',
      threat: '—',
      actionItems,
    },
    metadata: { confidence, dataPeriod: '최근 24시간' },
  }
}

export const FALLBACK_CONSENSUS: Consensus = legacyToConsensus({
  summary: '분석 불가. 데이터가 부족합니다.',
  sentiment: 0,
  strategic_insight: '—',
  action_item: '—',
  confidence: 0,
})

/** Normalize raw (legacy or new PM schema) payload from DB/cache into Consensus */
export function normalizeConsensus(raw: unknown): Consensus | null {
  if (!raw || typeof raw !== 'object') return null
  if (isPmAnalysisOutput(raw)) return pmAnalysisToConsensus(raw)
  const o = raw as Record<string, unknown>
  if (
    o.strategicSummary &&
    typeof o.strategicSummary === 'object' &&
    typeof (o.strategicSummary as Record<string, unknown>).summary === 'string'
  ) {
    const ss = o.strategicSummary as Record<string, unknown>
    const sent = o.sentiment as Record<string, unknown> | undefined
    const score =
      typeof sent?.score === 'number' ? Math.max(-100, Math.min(100, sent.score as number)) : 0
    const meta = o.metadata as Record<string, unknown> | undefined
    const confidence =
      typeof meta?.confidence === 'number' ? Math.max(0, Math.min(100, meta.confidence as number)) : 0
    const impact = Array.isArray(o.impactAnalysis)
      ? (o.impactAnalysis as ConsensusImpactItem[]).map((i) => ({
          subject: typeof i.subject === 'string' ? i.subject : '—',
          score: typeof i.score === 'number' ? Math.max(0, Math.min(10, i.score)) : 5,
          reason: typeof i.reason === 'string' ? i.reason.slice(0, 200) : undefined,
        }))
      : FALLBACK_CONSENSUS.impactAnalysis ?? []
    return {
      marketNews: Array.isArray(o.marketNews)
        ? (o.marketNews as string[]).filter((s): s is string => typeof s === 'string').slice(0, 10)
        : [],
      painPoints: Array.isArray(o.painPoints)
        ? (o.painPoints as string[]).filter((s): s is string => typeof s === 'string').slice(0, 10)
        : [],
      competitorTrends:
        typeof o.competitorTrends === 'string' ? o.competitorTrends.trim().slice(0, 500) : '',
      sentiment: {
        score,
        trend:
          sent?.trend === 'rising' || sent?.trend === 'falling' || sent?.trend === 'stable'
            ? sent.trend
            : 'stable',
        ratio:
          typeof sent?.ratio === 'object' && sent.ratio
            ? (sent.ratio as { positive?: number; neutral?: number; negative?: number })
            : undefined,
      },
      impactAnalysis: impact.length > 0 ? impact : (FALLBACK_CONSENSUS.impactAnalysis ?? []),
      strategicSummary: {
        summary: typeof ss.summary === 'string' ? ss.summary.trim().slice(0, 500) : '—',
        opportunity: typeof ss.opportunity === 'string' ? ss.opportunity.trim().slice(0, 300) : '—',
        threat: typeof ss.threat === 'string' ? ss.threat.trim().slice(0, 300) : '—',
        actionItems: Array.isArray(ss.actionItems)
          ? (ss.actionItems as string[])
              .filter((s): s is string => typeof s === 'string')
              .slice(0, 10)
          : [],
      },
      metadata: {
        confidence,
        dataPeriod: typeof meta?.dataPeriod === 'string' ? meta.dataPeriod : '최근 24시간',
      },
    }
  }
  if (typeof o.summary === 'string' && o.summary.trim() !== '') return legacyToConsensus(o)
  if (typeof o.sentiment === 'number') return legacyToConsensus(o)
  return null
}

function stripJsonCodeBlock(raw: string): string {
  const codeBlockMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/m)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  if (raw.startsWith('```')) {
    const afterOpen = raw.replace(/^```(?:json)?\s*\n?/i, '')
    const closeIdx = afterOpen.indexOf('```')
    return (closeIdx !== -1 ? afterOpen.slice(0, closeIdx) : afterOpen).trim()
  }
  return raw
}

/** Build consensus prompt for provider-agnostic synthesis (unified AI service). */
export function buildConsensusPrompt(geminiAnalysis: string, groqAnalysis: string): string {
  const g = String(geminiAnalysis ?? '').trim()
  const r = String(groqAnalysis ?? '').trim()
  if (g.length < 20 && r.length < 20) return ''
  const partialNote =
    g.length < 20 || r.length < 20
      ? '\n\n[참고: 한쪽 AI 분석만 사용되었거나 일부 데이터만으로 종합한 결과입니다.]'
      : ''
  return `${CONSENSUS_SYSTEM}${partialNote}\n\n${CONSENSUS_USER_PREFIX}${g.slice(0, 3000)}${CONSENSUS_USER_SUFFIX}${r.slice(0, 3000)}`
}

/** Parse raw model text into Consensus; returns FALLBACK_CONSENSUS on failure. Never throws. */
export function parseConsensusFromRawText(rawText: string): Consensus {
  const raw = stripJsonCodeBlock(rawText || '').trim()
  if (!raw || raw.length > 500_000) return FALLBACK_CONSENSUS
  const first = raw[0]
  const last = raw[raw.length - 1]
  if ((first !== '{' && first !== '[') || (last !== '}' && last !== ']')) {
    logger.warn('AI consensus: invalid JSON structure', { preview: raw.slice(0, 80) })
    return FALLBACK_CONSENSUS
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeConsensus(parsed)
    return normalized ?? FALLBACK_CONSENSUS
  } catch (parseErr) {
    logger.error('AI consensus: JSON parse failed', {
      parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
      rawLength: raw.length,
      rawPreview: raw.slice(0, 150),
    })
    return FALLBACK_CONSENSUS
  }
}
