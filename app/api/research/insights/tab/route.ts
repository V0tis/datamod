import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'
const GROQ_429_RETRY_DELAY_MS = 3000
const GROQ_QUOTA_MESSAGE = 'Groq 엔진 사용량 초과. 잠시 후 재시도해 주세요.'
const GEMINI_MODEL_PRIMARY = process.env.GEMINI_TAB_MODEL ?? 'gemini-3-flash-preview'
const GEMINI_BASE_URL_V1BETA = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_BASE_URL_V1 = 'https://generativelanguage.googleapis.com/v1/models'
const GEMINI_MODEL_FALLBACK = 'gemini-2.0-flash'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const UNIFIED_ERROR_MESSAGE = '현재 AI 엔진 트래픽이 높습니다. 잠시 후 다시 시도해 주세요.'
const ANALYSIS_FAILED_PLACEHOLDER = '분석 중단'

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

  // Read-through 캐시: isReanalyze false면 DB만 조회 후 반환. true일 때만 API 호출
  let mergedGroq: string | null = null
  let mergedGemini: string | null = null

  if (!isReanalyze && keyword) {
    const { data: cachedData } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_gemini')
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
        return NextResponse.json({
          groq: mergedGroq != null ? { text: mergedGroq } : null,
          gemini: mergedGemini != null ? { text: mergedGemini } : null,
        })
      }
    }
  }

  if (reportId && !isReanalyze) {
    const { data: historyRow } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_gemini, updated_at')
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

  const needGroq = (provider === 'all' || provider === 'groq') && mergedGroq == null
  const needGemini = (provider === 'all' || provider === 'gemini') && mergedGemini == null

  if (!needGroq && !needGemini) {
    return NextResponse.json({
      groq: mergedGroq != null ? { text: mergedGroq } : null,
      gemini: mergedGemini != null ? { text: mergedGemini } : null,
    })
  }

  if (!isReanalyze) {
    return NextResponse.json({
      groq: mergedGroq != null ? { text: mergedGroq } : null,
      gemini: mergedGemini != null ? { text: mergedGemini } : null,
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

  /** Gemini: v1beta + gemini-3-flash-preview 1차 시도, 404 시 v1 + gemini-2.0-flash Fallback. 429 시 quota_exceeded 반환 */
  async function callGemini(): Promise<{ text: string | null; quotaExceeded?: boolean }> {
    if (provider !== 'all' && provider !== 'gemini') return { text: null }
    const body = {
      contents: [{ parts: [{ text: fullPromptForGeminiAndHf }] }],
      generationConfig: { maxOutputTokens: 2048 },
    } as const
    const tryGemini = async (baseUrl: string, model: string): Promise<{ res: Response; data: unknown }> => {
      const url = `${baseUrl}/${model}:generateContent?key=${geminiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      return { res, data }
    }
    try {
      let { res, data } = await tryGemini(GEMINI_BASE_URL_V1BETA, GEMINI_MODEL_PRIMARY)
      if (res.status === 404) {
        console.warn('[Research Tab] Gemini 404, fallback to v1 + gemini-2.0-flash')
        const fallback = await tryGemini(GEMINI_BASE_URL_V1, GEMINI_MODEL_FALLBACK)
        res = fallback.res
        data = fallback.data
      }
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

  // analysis_results JSONB: gemini·groq만 저장 (HF 제거)
  const analysisResults = {
    gemini: resultG ?? ANALYSIS_FAILED_PLACEHOLDER,
    groq: resultGr ?? ANALYSIS_FAILED_PLACEHOLDER,
  }

  const hasAnyResult = groqResult !== null || geminiResult !== null
  if (hasAnyResult) {
    try {
      const { data: historyRow } = await supabase
        .from('research_history')
        .select('analysis_groq, analysis_gemini')
        .eq('user_id', user.id)
        .eq('keyword', keyword)
        .eq('country_code', countryCode)
        .maybeSingle()

      const prevGroq = (historyRow?.analysis_groq as Record<string, string>) ?? {}
      const prevGemini = (historyRow?.analysis_gemini as Record<string, string>) ?? {}
      const withTab = (prev: Record<string, string>, result: string | null, key: string) => {
        const next = { ...prev }
        if (result != null && String(result).trim().length > 0) next[key] = String(result).trim()
        return Object.fromEntries(Object.entries(next).filter(([, v]) => String(v).trim().length > 0)) as Record<string, string>
      }
      const nextGroq = withTab(prevGroq, groqResult, tab)
      const nextGemini = withTab(prevGemini, geminiResult, tab)

      await supabase.from('research_history').upsert(
        {
          user_id: user.id,
          keyword,
          country_code: countryCode,
          report_id: reportId ?? null,
          analysis_groq: Object.keys(nextGroq).length > 0 ? nextGroq : null,
          analysis_gemini: Object.keys(nextGemini).length > 0 ? nextGemini : null,
          analysis_results: analysisResults,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,keyword,country_code' }
      )
    } catch (e) {
      console.warn('[Research Tab] DB save', e)
    }
  }

  const hasAny =
    (groqResult != null && groqResult.length > 0) ||
    (geminiResult != null && geminiResult.length > 0)
  return NextResponse.json({
    groq: groqResult != null && groqResult.length > 0 ? { text: groqResult } : null,
    gemini: geminiResult != null && geminiResult.length > 0 ? { text: geminiResult } : null,
    ...(groqQuotaError ? { groqError: GROQ_QUOTA_MESSAGE } : {}),
    ...(geminiQuotaExceeded ? { status: 'quota_exceeded', geminiQuotaExceeded: true } : {}),
    ...(!hasAny ? { error: UNIFIED_ERROR_MESSAGE } : {}),
  })
}
