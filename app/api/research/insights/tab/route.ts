import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GEMINI_TAB_MODEL, GEMINI_CONSENSUS_MODEL } from '@/lib/gemini-config'
import {
  withExponentialBackoff,
  sleep,
  REQUEST_GAP_MS,
  RATE_LIMIT_USER_MESSAGE,
} from '@/lib/gemini-retry'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'
const GROQ_QUOTA_MESSAGE = 'Groq 엔진 사용량 초과. 잠시 후 재시도해 주세요.'
const GEMINI_BASE_URL_V1 = 'https://generativelanguage.googleapis.com/v1/models'

function buildGeminiGenerateContentUrl(apiKey: string): string {
  return `${GEMINI_BASE_URL_V1}/${GEMINI_TAB_MODEL}:generateContent?key=${apiKey}`
}

/** Consensus 전용: GEMINI_CONSENSUS_MODEL (기본 gemini-2.5-flash), maxOutputTokens 8192 */
function buildGeminiConsensusUrl(apiKey: string): string {
  return `${GEMINI_BASE_URL_V1}/${GEMINI_CONSENSUS_MODEL}:generateContent?key=${apiKey}`
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const UNIFIED_ERROR_MESSAGE = RATE_LIMIT_USER_MESSAGE

/** Context = Gemini + Groq 분석 텍스트. 이 context만 바탕으로 추출하며 검색/외부 데이터 사용 금지 */
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

impactAnalysis의 subject는 반드시 시장성, 기술성, 반응성, 규제/환경, 경쟁력 5개만 사용하세요.`;

const CONSENSUS_USER_PREFIX = '--- Gemini 분석 ---\n'
const CONSENSUS_USER_SUFFIX = '\n\n--- Groq 분석 ---\n'

/** 새 PM 프레임워크 포맷 (API 응답·DB 저장) */
export type ConsensusImpactItem = { subject: string; score: number; reason?: string }
export type ConsensusSentiment = { score: number; trend?: 'rising' | 'falling' | 'stable'; ratio?: { positive?: number; neutral?: number; negative?: number } }
export type ConsensusStrategicSummary = { summary: string; opportunity?: string; threat?: string; actionItems?: string[] }
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

/** 구형 flat 포맷 → Consensus (하위 호환) */
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

/** DB/캐시에서 읽은 값(구형 또는 신형)을 Consensus로 정규화 */
function normalizeConsensus(raw: unknown): Consensus | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  // 신형: strategicSummary 존재
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
  // 구형: summary + sentiment 숫자
  if (typeof o.summary === 'string' && o.summary.trim() !== '') return legacyToConsensus(o)
  if (typeof o.sentiment === 'number') return legacyToConsensus(o)
  return null
}

/** 두 분석이 모두 settled된 뒤에만 호출. 한쪽 실패 시에도 가능한 데이터로 요약 (일부 데이터만으로 종합). 항상 Consensus 객체 반환. */
async function generateConsensus(
  apiKey: string,
  geminiAnalysis: string,
  groqAnalysis: string
): Promise<Consensus> {
  const g = String(geminiAnalysis ?? '').trim()
  const r = String(groqAnalysis ?? '').trim()
  const bothEmpty = g.length < 20 && r.length < 20
  if (bothEmpty) return FALLBACK_CONSENSUS

  const partialNote = (g.length < 20 || r.length < 20)
    ? '\n\n[참고: 한쪽 AI 분석만 사용되었거나 일부 데이터만으로 종합한 결과입니다.]'
    : ''
  const prompt = `${CONSENSUS_SYSTEM}${partialNote}\n\n${CONSENSUS_USER_PREFIX}${g.slice(0, 3000)}${CONSENSUS_USER_SUFFIX}${r.slice(0, 3000)}`
  // v1 API: role 없이 contents.parts만 사용. responseMimeType은 v1에서 400 유발할 수 있어 제거(프롬프트에서 JSON 요청)
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192 },
  }
  try {
    const url = buildGeminiConsensusUrl(apiKey)
    const res = await withExponentialBackoff(
      async () => {
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (r.status === 429 || r.status >= 500) {
          const err = new Error(`Gemini Consensus ${r.status}`) as Error & { status?: number }
          err.status = r.status
          throw err
        }
        return r
      },
      { maxRetries: 5, baseDelayMs: 1000 }
    )
    const data = (await res.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      error?: { message?: string }
    }
    console.log('[Research Tab] Gemini Consensus synthesis', { status: res.status, errorMessage: data?.error?.message ?? null })
    if (!res.ok) return FALLBACK_CONSENSUS
    let raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    if (!raw) {
      console.warn('[AI Insight Consensus] generateConsensus: Gemini 응답 텍스트 없음', { hasCandidates: !!data?.candidates?.length })
      return FALLBACK_CONSENSUS
    }
    // Gemini가 ```json ... ``` 으로 감싼 경우 제거 후 파싱
    const codeBlockMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/m)
    if (codeBlockMatch) raw = codeBlockMatch[1].trim()
    else if (raw.startsWith('```')) {
      const afterOpen = raw.replace(/^```(?:json)?\s*\n?/i, '')
      const closeIdx = afterOpen.indexOf('```')
      raw = (closeIdx !== -1 ? afterOpen.slice(0, closeIdx) : afterOpen).trim()
    }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch (parseErr) {
      console.error('[AI Insight Consensus] generateConsensus JSON 파싱 실패', {
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawLength: raw.length,
        rawSnippet: raw.slice(0, 500),
      })
      return FALLBACK_CONSENSUS
    }
    const normalized = normalizeConsensus(parsed)
    if (normalized) return normalized
    return FALLBACK_CONSENSUS
  } catch (e) {
    console.warn('[Research Tab] Consensus synthesis', e)
    return FALLBACK_CONSENSUS
  }
}

/** Gemini·Groq 공통: 시장 분석 및 인사이트를 마크다운 형식으로 요약 */
const UNIFIED_SYSTEM_PROMPT =
  '시장 분석 및 인사이트를 마크다운 형식으로 요약해달라. 중요 키워드는 **강조**하고, 요청에 맞게 간결하게 답변하세요.'

export type TabType = 'logic' | 'creative' | 'fact'

/** 탭별 유저 프롬프트 (시스템 프롬프트는 UNIFIED_SYSTEM_PROMPT로 통일) */
function buildUserPrompt(
  tab: TabType,
  keyword: string,
  summary: string,
  newsHeadlines: string,
  logicText: string,
  creativeText: string
): string {
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인 (news_items_ko):\n${newsHeadlines}\n\n` : ''
  const baseSummary = summary ? `리포트 요약:\n${summary}\n\n` : ''

  if (tab === 'logic') {
    if (newsBlock) {
      return `키워드: "${keyword}"${newsBlock}위 실시간 뉴스(헤드라인)만 바탕으로, 이 뉴스들이 시사하는 내용을 정리해 주세요. 뉴스 요약과 시장·이슈 관점을 2~4문단으로 마크다운 요약해 주세요.`
    }
    return `키워드: "${keyword}"\n\n수집된 뉴스가 없습니다. 시장 분석은 실시간 뉴스가 있을 때 표시됩니다.`
  }
  if (tab === 'creative') {
    return `키워드: "${keyword}"${newsBlock}${baseSummary}위 내용을 바탕으로 향후 전망과 투자/행동 아이디어를 2~4문단 마크다운으로 요약해 주세요.`
  }
  const reportParts = [
    logicText ? `## 시장 분석\n${logicText}` : '',
    creativeText ? `## 인사이트\n${creativeText}` : '',
    summary ? `## 리포트 요약\n${summary}` : '',
    newsHeadlines ? `## 참고 뉴스 헤드라인\n${newsHeadlines}` : '',
  ].filter(Boolean)
  return `키워드: "${keyword}"\n\n아래 내용을 하나의 격식 있는 종합 리서치 보고서로 마크다운 요약해 주세요. 제목, 요약, 본문, 결론, PM을 위한 우선순위별 Action Item (P0, P1, P2) 섹션을 포함하세요.\n\n${reportParts.join('\n\n')}`
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: {
    keyword?: string
    summary?: string
    tab?: string
    reportId?: string
    newsHeadlines?: string
    logicText?: string
    creativeText?: string
    provider?: 'groq' | 'gemini' | 'all'
    isReanalyze?: boolean
    countryCode?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = (body?.keyword ?? '').trim()
  const summary = typeof body?.summary === 'string' ? body.summary : ''
  const tab = body?.tab as TabType | undefined
  const reportId = typeof body?.reportId === 'string' ? body.reportId : null
  const newsHeadlines = typeof body?.newsHeadlines === 'string' ? body.newsHeadlines.trim() : ''
  const logicText = typeof body?.logicText === 'string' ? body.logicText.trim() : ''
  const creativeText = typeof body?.creativeText === 'string' ? body.creativeText.trim() : ''
  const isReanalyze = body?.isReanalyze === true
  const countryCode = (typeof body?.countryCode === 'string' ? body.countryCode.trim() : '') || 'KR'
  const provider =
    body?.provider === 'groq' || body?.provider === 'gemini'
      ? body.provider
      : 'all'

  if (!tab || !['logic', 'creative', 'fact'].includes(tab)) {
    return NextResponse.json({ error: 'tab must be one of logic, creative, fact' }, { status: 400 })
  }
  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  // AI Insight Consensus API call: log request data (lengths + short preview for large fields)
  if (tab === 'creative' || isReanalyze) {
    console.log('[AI Insight Consensus] API call – request data', {
      keyword,
      tab,
      provider,
      isReanalyze,
      reportId: reportId ?? null,
      countryCode,
      summaryLength: typeof summary === 'string' ? summary.length : 0,
      summaryPreview: typeof summary === 'string' ? summary.slice(0, 200) : '',
      newsHeadlinesLength: newsHeadlines.length,
      newsHeadlinesPreview: newsHeadlines.slice(0, 150),
      logicTextLength: logicText.length,
      logicTextPreview: logicText.slice(0, 150),
      creativeTextLength: creativeText.length,
      creativeTextPreview: creativeText.slice(0, 150),
    })
  }

  // Read-through 캐시: isReanalyze false면 DB만 조회 후 반환. true일 때만 API 호출
  let mergedGroq: string | null = null
  let mergedGemini: string | null = null

  if (!isReanalyze && keyword) {
    const { data: cachedData } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_gemini, analysis_results')
      .eq('user_id', user.id)
      .eq('keyword', keyword)
      .eq('country_code', countryCode)
      .maybeSingle()

    if (cachedData) {
      const groqTab = (cachedData.analysis_groq ?? null) as Record<string, string> | null
      const geminiTab = (cachedData.analysis_gemini ?? null) as Record<string, string> | null
      mergedGroq = typeof groqTab?.[tab] === 'string' && groqTab[tab].trim().length > 0 ? groqTab[tab].trim() : null
      mergedGemini = typeof geminiTab?.[tab] === 'string' && geminiTab[tab].trim().length > 0 ? geminiTab[tab].trim() : null
      const allCached =
        (provider === 'all' && mergedGroq != null && mergedGemini != null) ||
        (provider === 'groq' && mergedGroq != null) ||
        (provider === 'gemini' && mergedGemini != null)
      if (allCached) {
        const ar = (cachedData.analysis_results ?? null) as Record<string, unknown> | null
        let cachedConsensus: Consensus | null = null
        if (ar) {
          const fromConsensus = ar.consensus != null ? normalizeConsensus(ar.consensus) : null
          const fromRoot = typeof ar.summary === 'string' ? normalizeConsensus(ar) : null
          cachedConsensus = fromConsensus ?? fromRoot
        }
        if (
          tab === 'creative' &&
          mergedGroq != null &&
          mergedGemini != null &&
          !cachedConsensus
        ) {
          const geminiKey = process.env.GOOGLE_GENAI_API_KEY?.trim()
          if (geminiKey) {
            const synthesized = await generateConsensus(geminiKey, mergedGemini, mergedGroq)
            if (synthesized) {
              cachedConsensus = synthesized
              await supabase
                .from('research_history')
                .update({ analysis_results: synthesized, updated_at: new Date().toISOString() })
                .eq('user_id', user.id)
                .eq('keyword', keyword)
                .eq('country_code', countryCode)
            }
          }
        }
        return NextResponse.json({
          groq: mergedGroq != null ? { text: mergedGroq } : null,
          gemini: mergedGemini != null ? { text: mergedGemini } : null,
          ...(cachedConsensus ? { consensus: cachedConsensus } : {}),
        })
      }
    }
  }

  if (reportId && !isReanalyze) {
    const { data: historyRow } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_gemini, analysis_results, updated_at')
      .eq('report_id', reportId)
      .eq('user_id', user.id)
      .maybeSingle()

    const cacheValid =
      !!historyRow?.updated_at && Date.now() - new Date(historyRow.updated_at).getTime() <= CACHE_TTL_MS
    if (cacheValid && historyRow) {
      const groqTab = (historyRow.analysis_groq ?? null) as Record<string, string> | null
      const geminiTab = (historyRow.analysis_gemini ?? null) as Record<string, string> | null
      const reportCachedGroq = typeof groqTab?.[tab] === 'string' && groqTab[tab].trim().length > 0 ? groqTab[tab].trim() : null
      const reportCachedGemini = typeof geminiTab?.[tab] === 'string' && geminiTab[tab].trim().length > 0 ? geminiTab[tab].trim() : null
      mergedGroq = mergedGroq ?? reportCachedGroq
      mergedGemini = mergedGemini ?? reportCachedGemini
    }
  }

  /** 재분석(Consensus만 다시 만들기): Creative 탭일 때 DB에 있는 Groq/Gemini 결과만 쓰고, API 재호출 안 함 */
  if (isReanalyze && tab === 'creative' && (mergedGroq == null || mergedGemini == null)) {
    const byReport = reportId
      ? await supabase.from('research_history').select('analysis_groq, analysis_gemini').eq('report_id', reportId).eq('user_id', user.id).maybeSingle()
      : { data: null }
    const byKeyword = !byReport.data
      ? await supabase.from('research_history').select('analysis_groq, analysis_gemini').eq('user_id', user.id).eq('keyword', keyword).eq('country_code', countryCode).maybeSingle()
      : { data: null }
    const historyRow = byReport.data ?? byKeyword.data
    if (historyRow) {
      const groqTab = (historyRow.analysis_groq ?? null) as Record<string, string> | null
      const geminiTab = (historyRow.analysis_gemini ?? null) as Record<string, string> | null
      const creativeGroq = typeof groqTab?.creative === 'string' && groqTab.creative.trim().length > 0 ? groqTab.creative.trim() : null
      const creativeGemini = typeof geminiTab?.creative === 'string' && geminiTab.creative.trim().length > 0 ? geminiTab.creative.trim() : null
      if (creativeGroq) mergedGroq = mergedGroq ?? creativeGroq
      if (creativeGemini) mergedGemini = mergedGemini ?? creativeGemini
      if (mergedGroq != null && mergedGemini != null) {
        console.log('[AI Insight Consensus] 재분석: DB에서 Creative만 사용, Groq/Gemini API 호출 생략')
      }
    }
  }

  const needGroq = (provider === 'all' || provider === 'groq') && mergedGroq == null
  const needGemini = (provider === 'all' || provider === 'gemini') && mergedGemini == null

  // 재분석(creative)일 때는 analysis_results 캐시를 쓰지 않고 항상 generateConsensus 재호출
  if (!needGroq && !needGemini && !(isReanalyze && tab === 'creative')) {
    const historyForConsensus = await supabase.from('research_history').select('analysis_results').eq('user_id', user.id).eq('keyword', keyword).eq('country_code', countryCode).maybeSingle()
    const ar = (historyForConsensus.data?.analysis_results ?? null) as Record<string, unknown> | null
    let c: Consensus | null = null
    if (ar) {
      c = (ar.consensus != null ? normalizeConsensus(ar.consensus) : null) ?? (typeof ar.summary === 'string' ? normalizeConsensus(ar) : null)
    }
    return NextResponse.json({
      groq: mergedGroq != null ? { text: mergedGroq } : null,
      gemini: mergedGemini != null ? { text: mergedGemini } : null,
      ...(c ? { consensus: c } : {}),
    })
  }

  const groqKey = process.env.GROQ_API_KEY?.trim()
  const geminiKey = process.env.GOOGLE_GENAI_API_KEY?.trim()

  if ((provider === 'all' || provider === 'groq') && !groqKey) {
    return NextResponse.json(
      { error: 'Groq API 키가 설정되지 않았습니다. GROQ_API_KEY를 설정해 주세요.' },
      { status: 400 }
    )
  }
  if ((provider === 'all' || provider === 'gemini') && !geminiKey) {
    return NextResponse.json(
      { error: 'Gemini API 키가 설정되지 않았습니다. GOOGLE_GENAI_API_KEY를 설정해 주세요.' },
      { status: 400 }
    )
  }

  const userPrompt = buildUserPrompt(tab, keyword, summary, newsHeadlines, logicText, creativeText)
  const fullPromptForGeminiAndHf = `${UNIFIED_SYSTEM_PROMPT}\n\n${userPrompt}`

  /** Groq / Gemini 각각 독립 호출. 서로의 결과를 참조하지 않음. 429 시 지수 백오프로 최대 5회 재시도. */
  async function callGroq(): Promise<{ text: string | null; quotaError?: boolean }> {
    if (provider !== 'all' && provider !== 'groq') return { text: null }
    try {
      const { res, data } = await withExponentialBackoff(
        async () => {
          const res = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${groqKey}`,
            },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages: [
                { role: 'system', content: UNIFIED_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
              ],
              max_tokens: 2048,
            }),
          })
          const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
          if (res.status === 429) {
            const err = new Error('Groq 429') as Error & { status?: number }
            err.status = 429
            throw err
          }
          return { res, data }
        },
        { maxRetries: 5, baseDelayMs: 1000 }
      )
      if (!res.ok) {
        console.warn('[Research Tab] Groq', res.status, data?.error?.message ?? data)
        return res.status === 429 ? { text: null, quotaError: true } : { text: null }
      }
      const text = data?.choices?.[0]?.message?.content?.trim() ?? ''
      return { text: text || null }
    } catch (e) {
      console.warn('[Research Tab] Groq', e)
      const is429 = (e as { status?: number })?.status === 429
      return { text: null, ...(is429 ? { quotaError: true } : {}) }
    }
  }

  /** Gemini: v1 + GEMINI_TAB_MODEL. 429/5xx 시 지수 백오프로 최대 5회 재시도 후 사용자 메시지 반환 */
  async function callGemini(): Promise<{ text: string | null; quotaExceeded?: boolean }> {
    if (provider !== 'all' && provider !== 'gemini') return { text: null }
    if (!geminiKey) return { text: null }
    const body = {
      contents: [{ parts: [{ text: fullPromptForGeminiAndHf }] }],
      generationConfig: { maxOutputTokens: 2048 },
    } as const
    try {
      const res = await withExponentialBackoff(
        async () => {
          const url = buildGeminiGenerateContentUrl(geminiKey!)
          const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (r.status === 429 || r.status >= 500) {
            const err = new Error(`Gemini ${r.status}`) as Error & { status?: number }
            err.status = r.status
            throw err
          }
          return r
        },
        { maxRetries: 5, baseDelayMs: 1000 }
      )
      const data = await res.json().catch(() => ({}))
      const parsed = data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        error?: { message?: string }
      }
      if (!res.ok) {
        console.warn('[Research Tab] Gemini', res.status, parsed?.error?.message ?? data)
        return res.status === 429 ? { text: null, quotaExceeded: true } : { text: null }
      }
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      return { text: text || null }
    } catch (e) {
      console.warn('[Research Tab] Gemini (all retries exhausted)', e)
      const is429 = (e as { status?: number })?.status === 429
      return { text: null, ...(is429 ? { quotaExceeded: true } : {}) }
    }
  }

  // 요청 큐잉: 동시 다발 호출 방지를 위해 Groq → 500ms 간격 → Gemini 순차 호출
  let groqPayload: { text: string | null; quotaError?: boolean }
  let geminiPayload: { text: string | null; quotaExceeded?: boolean }
  if (needGroq && needGemini) {
    groqPayload = await callGroq()
    await sleep(REQUEST_GAP_MS)
    geminiPayload = await callGemini()
  } else if (needGroq) {
    groqPayload = await callGroq()
    geminiPayload = { text: mergedGemini, quotaExceeded: false }
  } else if (needGemini) {
    geminiPayload = await callGemini()
    groqPayload = { text: mergedGroq, quotaError: false }
  } else {
    groqPayload = { text: mergedGroq, quotaError: false }
    geminiPayload = { text: mergedGemini, quotaExceeded: false }
  }
  const groqText = groqPayload.text
  const groqQuotaError = groqPayload.quotaError === true
  const geminiText = geminiPayload.text
  const geminiQuotaExceeded = geminiPayload.quotaExceeded === true

  const resultG = (provider === 'all' || provider === 'gemini') ? (geminiText ?? mergedGemini ?? '') : null
  const resultGr = (provider === 'all' || provider === 'groq') ? (groqText ?? mergedGroq ?? '') : null

  const groqResult = resultGr
  const geminiResult = resultG

  /** AllSettled로 Groq·Gemini가 모두 끝난 뒤에만 컨센서스 생성. 최소 한쪽 성공 시에만 호출. 두 AI 모두 실패 시 호출 중단. */
  let consensus: Consensus | null = null
  const groqOk = groqResult != null && String(groqResult).trim().length > 0
  const geminiOk = geminiResult != null && String(geminiResult).trim().length > 0
  const atLeastOneSuccess = groqOk || geminiOk
  if (tab === 'creative' && geminiKey && !geminiQuotaExceeded && atLeastOneSuccess) {
    // 한쪽 AI만 있어도 Consensus 생성 (없는 쪽은 빈 문자열로 전달)
    const geminiInput = (geminiResult ?? '').trim()
    const groqInput = (groqResult ?? '').trim()
    console.log('[AI Insight Consensus] generateConsensus input', { geminiInput, groqInput })
    consensus = await generateConsensus(geminiKey, geminiInput, groqInput)
    if (isReanalyze) {
      console.log('[AI Insight Consensus] generateConsensus 완료', { keyword, summaryLen: consensus?.strategicSummary?.summary?.length ?? 0, sentimentScore: consensus?.sentiment?.score })
    }
  }

  let existingConsensus: Consensus | null = null
  const hasAnyResult = groqResult !== null || geminiResult !== null
  if (hasAnyResult) {
    try {
      const { data: historyRow } = await supabase
        .from('research_history')
        .select('analysis_groq, analysis_gemini, analysis_results')
        .eq('user_id', user.id)
        .eq('keyword', keyword)
        .eq('country_code', countryCode)
        .maybeSingle()

      const prevGroq = (historyRow?.analysis_groq as Record<string, string>) ?? {}
      const prevGemini = (historyRow?.analysis_gemini as Record<string, string>) ?? {}
      const existingResults = (historyRow?.analysis_results ?? null) as Record<string, unknown> | null
      if (existingResults) {
        existingConsensus =
          (existingResults.consensus != null ? normalizeConsensus(existingResults.consensus) : null) ??
          (typeof existingResults.summary === 'string' ? normalizeConsensus(existingResults) : null)
      }

      const withTab = (prev: Record<string, string>, result: string | null, key: string) => {
        const next = { ...prev }
        if (result != null && String(result).trim().length > 0) next[key] = String(result).trim()
        return Object.fromEntries(Object.entries(next).filter(([, v]) => String(v).trim().length > 0)) as Record<string, string>
      }
      const nextGroq = withTab(prevGroq, groqResult, tab)
      const nextGemini = withTab(prevGemini, geminiResult, tab)

      // analysis_results: 새 JSON 포맷(Consensus)만 저장. Groq/Gemini 원본은 저장 금지. 생성된 결과가 있을 때만 업데이트.
      const consensusToSave = consensus ?? existingConsensus
      const upsertPayload: Record<string, unknown> = {
        user_id: user.id,
        keyword,
        country_code: countryCode,
        report_id: reportId ?? null,
        analysis_groq: Object.keys(nextGroq).length > 0 ? nextGroq : null,
        analysis_gemini: Object.keys(nextGemini).length > 0 ? nextGemini : null,
        updated_at: new Date().toISOString(),
      }
      if (consensusToSave != null) {
        upsertPayload.analysis_results = consensusToSave
      }

      if (tab === 'creative' && isReanalyze && consensusToSave != null) {
        console.log('[AI Insight Consensus] research_history upsert (analysis_results 저장)', { keyword, countryCode })
      }

      await supabase.from('research_history').upsert(
        upsertPayload,
        { onConflict: 'user_id,keyword,country_code' }
      )
    } catch (e) {
      console.warn('[Research Tab] DB save', e)
    }
  }

  const hasAny =
    (groqResult != null && groqResult.length > 0) ||
    (geminiResult != null && geminiResult.length > 0)
  const finalConsensus = consensus ?? existingConsensus ?? (tab === 'creative' ? FALLBACK_CONSENSUS : null)
  if (tab === 'creative' && isReanalyze) {
    console.log('[AI Insight Consensus] 응답 반환', { keyword, hasConsensus: !!finalConsensus })
  }
  return NextResponse.json({
    groq: groqResult != null && groqResult.length > 0 ? { text: groqResult } : null,
    gemini: geminiResult != null && geminiResult.length > 0 ? { text: geminiResult } : null,
    ...(finalConsensus ? { consensus: finalConsensus } : {}),
    ...(groqQuotaError ? { groqError: GROQ_QUOTA_MESSAGE } : {}),
    ...(geminiQuotaExceeded ? { status: 'quota_exceeded', geminiQuotaExceeded: true, geminiError: RATE_LIMIT_USER_MESSAGE } : {}),
    ...(!hasAny ? { error: RATE_LIMIT_USER_MESSAGE } : {}),
  })
}
