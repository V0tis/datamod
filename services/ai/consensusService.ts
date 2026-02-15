/**
 * Research insight consensus: synthesize Gemini + Groq analyses into a single
 * PM-oriented Consensus (marketNews, painPoints, strategicSummary, etc.).
 * Single responsibility: build prompt, call Gemini, parse and normalize JSON.
 */
import {
  requestGenerateContent,
  parseGenerateContentResponse,
  getConsensusModel,
} from '@/services/ai/geminiClient'

/** PM framework format (API response and DB storage) */
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

const CONSENSUS_SYSTEM = `당신은 PM(Product Manager) 전략 수립을 돕는 분석가입니다.
아래 [Gemini 분석]과 [Groq 분석]에 **제공된 텍스트만**을 바탕으로 정보를 추출하세요. 검색이나 외부 데이터를 사용하지 마세요.
반드시 제공된 데이터에 근거하여 아래 JSON 구조로만 출력하세요. 다른 텍스트는 포함하지 마세요.
각 항목(marketNews, reason, summary 등)은 1~2문장으로 간결히 작성하세요.

JSON 구조:
{
  "marketNews": ["수집된 데이터에서 가장 비중 있게 다뤄진 핵심 뉴스 3~5개 요약 (문자열 배열)"],
  "painPoints": ["유저의 구체적 불편함 및 미충족 니즈 (문자열 배열)"],
  "competitorTrends": "주요 경쟁사 동향 요약 문자열 (없을 시 '정보 부족' 기재)",
  "sentiment": {
    "score": -100~100 숫자 (음수=부정, 양수=긍정, 0=중립),
    "trend": "rising" | "falling" | "stable",
    "ratio": { "positive": 0~100, "neutral": 0~100, "negative": 0~100 }
  },
  "impactAnalysis": [
    { "subject": "시장성", "score": 0~10, "reason": "점수 근거 한 줄" },
    { "subject": "기술성", "score": 0~10, "reason": "점수 근거 한 줄" },
    { "subject": "반응성", "score": 0~10, "reason": "점수 근거 한 줄" },
    { "subject": "규제/환경", "score": 0~10, "reason": "점수 근거 한 줄" },
    { "subject": "경쟁력", "score": 0~10, "reason": "점수 근거 한 줄" }
  ],
  "strategicSummary": {
    "summary": "시장 상황 PM 관점 요약 (150자 이내)",
    "opportunity": "즉시 활용 가능한 기회 요소",
    "threat": "잠재적 리스크 및 위협",
    "actionItems": ["PM 우선순위 과제 1", "과제 2", "과제 3"]
  },
  "metadata": {
    "confidence": 0~100 (두 AI 의견 일치도),
    "dataPeriod": "최근 24시간"
  }
}

impactAnalysis의 subject는 반드시 시장성, 기술성, 반응성, 규제/환경, 경쟁력 5개만 사용하세요.`

function legacyToConsensus(o: Record<string, unknown>): Consensus {
  const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 500) : '분석 불가. 데이터가 부족합니다.'
  const sentimentScore = typeof o.sentiment === 'number' ? Math.max(-100, Math.min(100, o.sentiment)) : 0
  const confidence = typeof o.confidence === 'number' ? Math.max(0, Math.min(100, o.confidence)) : 0
  const action_item = o.action_item
  const actionItems = Array.isArray(action_item)
    ? (action_item as string[]).filter((s): s is string => typeof s === 'string').slice(0, 5)
    : typeof action_item === 'string' && action_item !== '—'
      ? [action_item.trim()].filter(Boolean)
      : []
  return {
    marketNews: [],
    painPoints: [],
    competitorTrends: '',
    sentiment: { score: sentimentScore, trend: 'stable', ratio: { positive: 0, neutral: 0, negative: 0 } },
    impactAnalysis: [
      { subject: '시장성', score: 5, reason: '—' },
      { subject: '기술성', score: 5, reason: '—' },
      { subject: '반응성', score: 5, reason: '—' },
      { subject: '규제/환경', score: 5, reason: '—' },
      { subject: '경쟁력', score: 5, reason: '—' },
    ],
    strategicSummary: {
      summary,
      opportunity: typeof o.strategic_insight === 'string' ? o.strategic_insight.trim().slice(0, 300) : '—',
      threat: '—',
      actionItems,
    },
    metadata: { confidence, dataPeriod: '최근 24시간' },
  }
}

const FALLBACK_CONSENSUS: Consensus = legacyToConsensus({
  summary: '분석 불가. 데이터가 부족합니다.',
  sentiment: 0,
  strategic_insight: '—',
  action_item: '—',
  confidence: 0,
})

/** Normalize raw (legacy or new) payload from DB/cache into Consensus */
export function normalizeConsensus(raw: unknown): Consensus | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.strategicSummary && typeof o.strategicSummary === 'object' && typeof (o.strategicSummary as Record<string, unknown>).summary === 'string') {
    const ss = o.strategicSummary as Record<string, unknown>
    const sent = o.sentiment as Record<string, unknown> | undefined
    const score = typeof sent?.score === 'number' ? Math.max(-100, Math.min(100, sent.score as number)) : 0
    const meta = o.metadata as Record<string, unknown> | undefined
    const confidence = typeof meta?.confidence === 'number' ? Math.max(0, Math.min(100, meta.confidence as number)) : 0
    const impact = Array.isArray(o.impactAnalysis)
      ? (o.impactAnalysis as ConsensusImpactItem[]).map((i) => ({
          subject: typeof i.subject === 'string' ? i.subject : '—',
          score: typeof i.score === 'number' ? Math.max(0, Math.min(10, i.score)) : 5,
          reason: typeof i.reason === 'string' ? i.reason.slice(0, 200) : undefined,
        }))
      : FALLBACK_CONSENSUS.impactAnalysis ?? []
    return {
      marketNews: Array.isArray(o.marketNews) ? (o.marketNews as string[]).filter((s): s is string => typeof s === 'string').slice(0, 10) : [],
      painPoints: Array.isArray(o.painPoints) ? (o.painPoints as string[]).filter((s): s is string => typeof s === 'string').slice(0, 10) : [],
      competitorTrends: typeof o.competitorTrends === 'string' ? o.competitorTrends.trim().slice(0, 500) : '',
      sentiment: {
        score,
        trend: sent?.trend === 'rising' || sent?.trend === 'falling' || sent?.trend === 'stable' ? sent.trend : 'stable',
        ratio: typeof sent?.ratio === 'object' && sent.ratio ? sent.ratio as { positive?: number; neutral?: number; negative?: number } : undefined,
      },
      impactAnalysis: impact.length >= 5 ? impact : (FALLBACK_CONSENSUS.impactAnalysis ?? []),
      strategicSummary: {
        summary: typeof ss.summary === 'string' ? ss.summary.trim().slice(0, 500) : '—',
        opportunity: typeof ss.opportunity === 'string' ? ss.opportunity.trim().slice(0, 300) : '—',
        threat: typeof ss.threat === 'string' ? ss.threat.trim().slice(0, 300) : '—',
        actionItems: Array.isArray(ss.actionItems) ? (ss.actionItems as string[]).filter((s): s is string => typeof s === 'string').slice(0, 10) : [],
      },
      metadata: { confidence, dataPeriod: typeof meta?.dataPeriod === 'string' ? meta.dataPeriod : '최근 24시간' },
    }
  }
  if (typeof o.summary === 'string' && o.summary.trim() !== '') return legacyToConsensus(o)
  if (typeof o.sentiment === 'number') return legacyToConsensus(o)
  return null
}

export { FALLBACK_CONSENSUS }

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

/**
 * Synthesize Gemini + Groq analyses into one Consensus. Call after both analyses are available.
 * Returns fallback Consensus on parse/API errors; never throws.
 */
export async function synthesizeConsensus(
  apiKey: string,
  geminiAnalysis: string,
  groqAnalysis: string
): Promise<Consensus> {
  const g = String(geminiAnalysis ?? '').trim()
  const r = String(groqAnalysis ?? '').trim()
  if (g.length < 20 && r.length < 20) return FALLBACK_CONSENSUS

  const partialNote =
    g.length < 20 || r.length < 20
      ? '\n\n[참고: 한쪽 AI 분석만 사용되었거나 일부 데이터만으로 종합한 결과입니다.]'
      : ''
  const prompt = `${CONSENSUS_SYSTEM}${partialNote}\n\n${CONSENSUS_USER_PREFIX}${g.slice(0, 3000)}${CONSENSUS_USER_SUFFIX}${r.slice(0, 3000)}`
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192 },
  }
  try {
    const res = await requestGenerateContent(apiKey, body, getConsensusModel())
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string }
    }
    console.log('[Research Tab] Gemini Consensus synthesis', { status: res.status, errorMessage: data?.error?.message ?? null })
    if (!res.ok) return FALLBACK_CONSENSUS
    let raw = parseGenerateContentResponse(data)
    if (!raw) {
      console.warn('[AI Insight Consensus] synthesizeConsensus: Gemini 응답 텍스트 없음', {
        hasCandidates: !!data?.candidates?.length,
      })
      return FALLBACK_CONSENSUS
    }
    raw = stripJsonCodeBlock(raw)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch (parseErr) {
      console.error('[AI Insight Consensus] synthesizeConsensus JSON 파싱 실패', {
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawLength: raw.length,
        rawSnippet: raw.slice(0, 500),
      })
      return FALLBACK_CONSENSUS
    }
    const normalized = normalizeConsensus(parsed)
    return normalized ?? FALLBACK_CONSENSUS
  } catch (e) {
    console.warn('[Research Tab] Consensus synthesis', e)
    return FALLBACK_CONSENSUS
  }
}
