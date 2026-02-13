import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GEMINI_TAB_MODEL } from '@/lib/gemini-config'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'
const GROQ_429_RETRY_DELAY_MS = 3000
const GROQ_QUOTA_MESSAGE = 'Groq 엔진 사용량 초과. 잠시 후 재시도해 주세요.'
const GEMINI_BASE_URL_V1 = 'https://generativelanguage.googleapis.com/v1/models'

function buildGeminiGenerateContentUrl(apiKey: string): string {
  return `${GEMINI_BASE_URL_V1}/${GEMINI_TAB_MODEL}:generateContent?key=${apiKey}`
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const UNIFIED_ERROR_MESSAGE = '현재 AI 엔진 트래픽이 높습니다. 잠시 후 다시 시도해 주세요.'

/** 2사(Gemini + Groq) 종합 요약 → PM 관점 JSON. results 페이지 전용 "AI Insight Consensus" 블록에 표시 */
const CONSENSUS_SYSTEM = `
두 분석 결과를 종합하여 다음 형식의 JSON으로만 응답해. 다른 텍스트는 포함하지 말 것.
{
  "summary": "150자 이내의 종합 요약",
  "sentiment": -100~100 사이 감성 점수 (음수=부정, 양수=긍정, 0=중립),
  "strategic_insight": "이 이슈가 시사하는 핵심 전략 한 줄",
  "action_item": "사용자가 고려해야 할 다음 실행 권고",
  "confidence": 0~100 사이의 두 AI 의견 일치도(신뢰도)
}
`;
const CONSENSUS_USER_PREFIX = '--- Gemini 분석 ---\n'
const CONSENSUS_USER_SUFFIX = '\n\n--- Groq 분석 ---\n'

export type Consensus = {
  summary: string
  sentiment: number
  strategic_insight: string
  action_item: string
  confidence: number
}

/** 입력 부족 시 UI가 깨지지 않도록 반환하는 기본 컨센서스 */
const FALLBACK_CONSENSUS: Consensus = {
  summary: '분석 불가. 데이터가 부족합니다.',
  sentiment: 0,
  strategic_insight: '—',
  action_item: '—',
  confidence: 0,
}

/** DB/캐시에서 읽은 구형 포맷(positiveKeywords 등)을 새 Consensus 포맷으로 정규화 */
function normalizeConsensus(raw: unknown): Consensus | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const summary = typeof o.summary === 'string' ? o.summary.trim().slice(0, 200) : ''
  if (!summary) return null
  const sentiment = typeof o.sentiment === 'number' ? Math.max(-100, Math.min(100, o.sentiment)) : 0
  const strategic_insight = typeof o.strategic_insight === 'string' ? o.strategic_insight.trim().slice(0, 300) : '—'
  const action_item = typeof o.action_item === 'string' ? o.action_item.trim().slice(0, 300) : '—'
  const confidence = typeof o.confidence === 'number' ? Math.max(0, Math.min(100, o.confidence)) : 0
  return { summary, sentiment, strategic_insight, action_item, confidence }
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
    generationConfig: { maxOutputTokens: 2048 },
  }
  try {
    const url = buildGeminiGenerateContentUrl(apiKey)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
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
    let parsed: { summary?: string; sentiment?: number; strategic_insight?: string; action_item?: string; confidence?: number }
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch (parseErr) {
      console.error('[AI Insight Consensus] generateConsensus JSON 파싱 실패', {
        parseError: parseErr instanceof Error ? parseErr.message : String(parseErr),
        rawLength: raw.length,
        rawSnippet: raw.slice(0, 500),
      })
      return FALLBACK_CONSENSUS
    }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 200) : FALLBACK_CONSENSUS.summary
    const sentiment = typeof parsed.sentiment === 'number' ? Math.max(-100, Math.min(100, parsed.sentiment)) : 0
    const strategic_insight = typeof parsed.strategic_insight === 'string' ? parsed.strategic_insight.trim().slice(0, 300) : FALLBACK_CONSENSUS.strategic_insight
    const action_item = typeof parsed.action_item === 'string' ? parsed.action_item.trim().slice(0, 300) : FALLBACK_CONSENSUS.action_item
    const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 0
    return { summary, sentiment, strategic_insight, action_item, confidence }
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

  /** Groq / Gemini 각각 독립 호출. 서로의 결과를 참조하지 않음. */
  async function callGroq(): Promise<{ text: string | null; quotaError?: boolean }> {
    if (provider !== 'all' && provider !== 'groq') return { text: null }
    const doRequest = async (): Promise<{ res: Response; data: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } }> => {
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
      return { res, data }
    }
    try {
      let { res, data } = await doRequest()
      if (res.status === 429) {
        console.warn('[Research Tab] Groq 429, 3초 후 1회 재시도')
        await new Promise((r) => setTimeout(r, GROQ_429_RETRY_DELAY_MS))
        const retry = await doRequest()
        res = retry.res
        data = retry.data
      }
      if (!res.ok) {
        console.warn('[Research Tab] Groq', res.status, data?.error?.message ?? data)
        return res.status === 429 ? { text: null, quotaError: true } : { text: null }
      }
      const text = data?.choices?.[0]?.message?.content?.trim() ?? ''
      return { text: text || null }
    } catch (e) {
      console.warn('[Research Tab] Groq', e)
      return { text: null }
    }
  }

  /** Gemini: v1 + GEMINI_TAB_MODEL(gemini-2.5-flash). ConsensusInsight와 동일 모델 사용. 429 시 quota_exceeded 반환 */
  async function callGemini(): Promise<{ text: string | null; quotaExceeded?: boolean }> {
    if (provider !== 'all' && provider !== 'gemini') return { text: null }
    const body = {
      contents: [{ parts: [{ text: fullPromptForGeminiAndHf }] }],
      generationConfig: { maxOutputTokens: 2048 },
    } as const
    try {
      if (!geminiKey) return { text: null }
      const url = buildGeminiGenerateContentUrl(geminiKey)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      const parsed = data as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        error?: { message?: string }
      }
      if (res.status === 429) {
        console.warn('[Research Tab] Gemini 429 quota exceeded', res)
        return { text: null, quotaExceeded: true }
      }
      if (!res.ok) {
        console.warn('[Research Tab] Gemini', res.status, parsed?.error?.message ?? data)
        return { text: null }
      }
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      return { text: text || null }
    } catch (e) {
      console.warn('[Research Tab] Gemini', e)
      return { text: null }
    }
  }

  // 캐시 있는 엔진은 API 호출 생략, 없는 엔진만 호출 (Gemini·Groq만)
  const [groqSettled, geminiSettled] = await Promise.allSettled([
    needGroq ? callGroq() : Promise.resolve({ text: mergedGroq, quotaError: false as const }),
    needGemini ? callGemini() : Promise.resolve({ text: mergedGemini, quotaExceeded: false as const }),
  ])
  const groqPayload = groqSettled.status === 'fulfilled' ? groqSettled.value : { text: null, quotaError: false }
  const groqText = groqPayload.text
  const groqQuotaError = groqPayload.quotaError === true
  const geminiPayload = geminiSettled.status === 'fulfilled' ? geminiSettled.value : { text: null, quotaExceeded: false }
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
      console.log('[AI Insight Consensus] generateConsensus 완료', { keyword, summaryLen: consensus?.summary?.length ?? 0, sentiment: consensus?.sentiment })
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
    ...(geminiQuotaExceeded ? { status: 'quota_exceeded', geminiQuotaExceeded: true } : {}),
    ...(!hasAny ? { error: UNIFIED_ERROR_MESSAGE } : {}),
  })
}
