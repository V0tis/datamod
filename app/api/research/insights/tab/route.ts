/**
 * POST /api/research/insights/tab
 *
 * Responsibility: Tab-level AI analysis (logic/creative/fact) and consensus. Cache in research_history; key (user_id, keyword, country_code); TTL 24h.
 * Flow: auth → parse body → cache read (keyword, then report_id fallback) → reanalyze path fills from DB → needGroq/needGemini → runTabAnalysis → consensus (creative only) → upsert → JSON.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RATE_LIMIT_USER_MESSAGE } from '@/lib/gemini-retry'
import {
  RESEARCH_CACHE_TTL_MS,
  isCacheValid,
  logCacheEvent,
  buildCacheKeyParts,
  type ResearchCacheScope,
} from '@/lib/research-cache'
import { getTabProviderKeysForUser } from '@/lib/research-keys'
import type { TabAnalysisRecord } from '@/lib/research-types'
import { PM_ANALYSIS_PRINCIPLES } from '@/lib/ai/pm-analysis-framework'
import {
  type Consensus,
  type ConsensusImpactItem,
  type ConsensusSentiment,
  type ConsensusStrategicSummary,
  type ConsensusMetadata,
  normalizeConsensus,
  synthesizeConsensus,
  FALLBACK_CONSENSUS,
  runTabAnalysis,
} from '@/lib/ai'

// Re-export types for API consumers (e.g. frontend)
export type { Consensus, ConsensusImpactItem, ConsensusSentiment, ConsensusStrategicSummary, ConsensusMetadata }

const GROQ_QUOTA_MESSAGE = 'Groq 엔진 사용량 초과. 잠시 후 재시도해 주세요.'
const CACHE_SCOPE: ResearchCacheScope = 'insight_tab'

/** Gemini·Groq 공통: PM 분석 프레임워크 + 시장 분석 마크다운. 대화형 표현 금지. */
const UNIFIED_SYSTEM_PROMPT = `${PM_ANALYSIS_PRINCIPLES}

시장 분석 및 인사이트를 마크다운으로 요약. 중요 키워드 **강조**. Facts/Hypotheses/Inferences 구분 사용. 질문·이모지 금지.`

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

  const tabKeys = await getTabProviderKeysForUser(supabase, user.id)

  if (!tab || !['logic', 'creative', 'fact'].includes(tab)) {
    return NextResponse.json({ error: 'tab must be one of logic, creative, fact' }, { status: 400 })
  }
  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  // Log request metadata for cost attribution and debugging duplicate AI calls (no PII).
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

  // --- Cache: one row per (user_id, keyword, country_code). TTL 24h. Valid cache => skip AI; expired => allow new calls.
  const cacheKey = buildCacheKeyParts(user.id, keyword, countryCode)
  /** This tab's text: from cache or from this request; used for response and for merging into DB. */
  let mergedGroq: string | null = null
  let mergedGemini: string | null = null

  // Lookup 1: by keyword (primary). Fills mergedGroq/mergedGemini when cache hit and provider matches.
  if (!isReanalyze && keyword) {
    const { data: cachedData } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_gemini, analysis_results, updated_at')
      .eq('user_id', cacheKey.userId)
      .eq('keyword', cacheKey.keyword)
      .eq('country_code', cacheKey.countryCode)
      .maybeSingle()

    const cacheValid = cachedData?.updated_at != null && isCacheValid(cachedData.updated_at, RESEARCH_CACHE_TTL_MS)
    if (cachedData && !cacheValid) {
      logCacheEvent('expired', {
        scope: CACHE_SCOPE,
        keyword,
        countryCode,
        tab,
        source: 'keyword',
        detail: 'ttl_exceeded',
        updatedAt: cachedData.updated_at ?? undefined,
      })
    }

    if (cachedData && cacheValid) {
      const groqTab = (cachedData.analysis_groq ?? null) as TabAnalysisRecord | null
      const geminiTab = (cachedData.analysis_gemini ?? null) as TabAnalysisRecord | null
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
        // Creative tab hit but no consensus in DB yet: synthesize once and write back (cost: one Gemini call).
        if (
          tab === 'creative' &&
          mergedGroq != null &&
          mergedGemini != null &&
          !cachedConsensus
        ) {
          if (tabKeys.gemini) {
            const synthesized = await synthesizeConsensus({
              apiKey: tabKeys.gemini,
              geminiAnalysis: mergedGemini,
              groqAnalysis: mergedGroq,
            })
            if (synthesized) {
              cachedConsensus = synthesized
              await supabase
                .from('research_history')
                .update({ analysis_results: synthesized, updated_at: new Date().toISOString() })
                .eq('user_id', cacheKey.userId)
                .eq('keyword', cacheKey.keyword)
                .eq('country_code', cacheKey.countryCode)
            }
          }
        }
        // Cost: no Groq/Gemini/Consensus API calls; response from cache (24h TTL).
        logCacheEvent('hit', {
          scope: CACHE_SCOPE,
          keyword,
          countryCode,
          tab,
          source: 'keyword',
          detail: 'full',
          skippedAi: true,
          updatedAt: cachedData.updated_at ?? undefined,
        })
        return NextResponse.json({
          groq: mergedGroq != null ? { text: mergedGroq } : null,
          gemini: mergedGemini != null ? { text: mergedGemini } : null,
          ...(cachedConsensus ? { consensus: cachedConsensus } : {}),
        })
      }
    }
  }

  // Lookup 2: by report_id when keyword lookup missed (e.g. client sent reportId before keyword row exists). Same TTL.
  if (reportId && !isReanalyze) {
    const { data: historyRow } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_gemini, analysis_results, updated_at')
      .eq('report_id', reportId)
      .eq('user_id', cacheKey.userId)
      .maybeSingle()

    const reportCacheValid = historyRow?.updated_at != null && isCacheValid(historyRow.updated_at, RESEARCH_CACHE_TTL_MS)
    if (reportCacheValid && historyRow) {
      const groqTab = (historyRow.analysis_groq ?? null) as TabAnalysisRecord | null
      const geminiTab = (historyRow.analysis_gemini ?? null) as TabAnalysisRecord | null
      const reportCachedGroq = typeof groqTab?.[tab] === 'string' && groqTab[tab].trim().length > 0 ? groqTab[tab].trim() : null
      const reportCachedGemini = typeof geminiTab?.[tab] === 'string' && geminiTab[tab].trim().length > 0 ? geminiTab[tab].trim() : null
      mergedGroq = mergedGroq ?? reportCachedGroq
      mergedGemini = mergedGemini ?? reportCachedGemini
    }
  }

  // Reanalyze path: user asked to regenerate consensus only. Fill mergedGroq/mergedGemini from DB so we skip Groq/Gemini tab calls.
  if (isReanalyze && tab === 'creative' && (mergedGroq == null || mergedGemini == null)) {
    const byReport = reportId
      ? await supabase.from('research_history').select('analysis_groq, analysis_gemini').eq('report_id', reportId).eq('user_id', cacheKey.userId).maybeSingle()
      : { data: null }
    const byKeyword = !byReport.data
      ? await supabase.from('research_history').select('analysis_groq, analysis_gemini').eq('user_id', cacheKey.userId).eq('keyword', cacheKey.keyword).eq('country_code', cacheKey.countryCode).maybeSingle()
      : { data: null }
    const historyRow = byReport.data ?? byKeyword.data
    if (historyRow) {
      const groqTab = (historyRow.analysis_groq ?? null) as TabAnalysisRecord | null
      const geminiTab = (historyRow.analysis_gemini ?? null) as TabAnalysisRecord | null
      const creativeGroq = typeof groqTab?.creative === 'string' && groqTab.creative.trim().length > 0 ? groqTab.creative.trim() : null
      const creativeGemini = typeof geminiTab?.creative === 'string' && geminiTab.creative.trim().length > 0 ? geminiTab.creative.trim() : null
      if (creativeGroq) mergedGroq = mergedGroq ?? creativeGroq
      if (creativeGemini) mergedGemini = mergedGemini ?? creativeGemini
      if (mergedGroq != null && mergedGemini != null) {
        // Cost: reanalyze path — no Groq/Gemini tab calls; only Consensus (one Gemini call) below.
        console.log('[AI Insight Consensus] 재분석: DB에서 Creative만 사용, Groq/Gemini API 호출 생략')
      }
    }
  }

  const needGroq = (provider === 'all' || provider === 'groq') && mergedGroq == null
  const needGemini = (provider === 'all' || provider === 'gemini') && mergedGemini == null

  // Cost: both providers already cached for this tab; no Groq/Gemini calls. Return stored consensus only.
  if (!needGroq && !needGemini && !(isReanalyze && tab === 'creative')) {
    const historyForConsensus = await supabase.from('research_history').select('analysis_results, updated_at').eq('user_id', cacheKey.userId).eq('keyword', cacheKey.keyword).eq('country_code', cacheKey.countryCode).maybeSingle()
    const ar = (historyForConsensus.data?.analysis_results ?? null) as Record<string, unknown> | null
    let c: Consensus | null = null
    if (ar) {
      c = (ar.consensus != null ? normalizeConsensus(ar.consensus) : null) ?? (typeof ar.summary === 'string' ? normalizeConsensus(ar) : null)
    }
    logCacheEvent('hit', {
      scope: CACHE_SCOPE,
      keyword,
      countryCode,
      tab,
      source: 'keyword',
      detail: 'consensus_only',
      skippedAi: true,
      updatedAt: historyForConsensus.data?.updated_at ?? undefined,
    })
    return NextResponse.json({
      groq: mergedGroq != null ? { text: mergedGroq } : null,
      gemini: mergedGemini != null ? { text: mergedGemini } : null,
      ...(c ? { consensus: c } : {}),
    })
  }

  const groqKey = tabKeys.groq || null
  const geminiKey = tabKeys.gemini || null

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

  const aiCallDetail = needGroq && needGemini ? 'groq_and_gemini' : needGroq ? 'groq' : 'gemini'
  logCacheEvent('miss', {
    scope: CACHE_SCOPE,
    keyword,
    countryCode,
    tab,
    detail: aiCallDetail,
  })

  const analysisResult = await runTabAnalysis({
    groqKey: groqKey || null,
    geminiKey: geminiKey || null,
    provider,
    systemPrompt: UNIFIED_SYSTEM_PROMPT,
    userPrompt,
  })

  const groqText = needGroq ? analysisResult.groqText : mergedGroq
  const geminiText = needGemini ? analysisResult.geminiText : mergedGemini
  const groqQuotaError = analysisResult.groqQuotaError
  const geminiQuotaExceeded = analysisResult.geminiQuotaExceeded

  /** Final text to return and to merge into DB: from this request or from cache, depending on provider. */
  const groqResult =
    (provider === 'all' || provider === 'groq') ? (groqText ?? mergedGroq ?? '') : null
  const geminiResult =
    (provider === 'all' || provider === 'gemini') ? (geminiText ?? mergedGemini ?? '') : null

  /** Consensus only when we have at least one successful result; skip if both AI calls failed. */
  let consensus: Consensus | null = null
  const groqOk = groqResult != null && String(groqResult).trim().length > 0
  const geminiOk = geminiResult != null && String(geminiResult).trim().length > 0
  const atLeastOneSuccess = groqOk || geminiOk
  if (tab === 'creative' && geminiKey && !geminiQuotaExceeded && atLeastOneSuccess) {
    // 한쪽 AI만 있어도 Consensus 생성 (없는 쪽은 빈 문자열로 전달)
    const geminiInput = (geminiResult ?? '').trim()
    const groqInput = (groqResult ?? '').trim()
    console.log('[AI Insight Consensus] generateConsensus input', { geminiInput, groqInput })
    consensus = await synthesizeConsensus({
      apiKey: geminiKey,
      geminiAnalysis: geminiInput,
      groqAnalysis: groqInput,
    })
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
        .eq('user_id', cacheKey.userId)
        .eq('keyword', cacheKey.keyword)
        .eq('country_code', cacheKey.countryCode)
        .maybeSingle()

      const prevGroq = (historyRow?.analysis_groq as TabAnalysisRecord) ?? {}
      const prevGemini = (historyRow?.analysis_gemini as TabAnalysisRecord) ?? {}
      const existingResults = (historyRow?.analysis_results ?? null) as Record<string, unknown> | null
      if (existingResults) {
        existingConsensus =
          (existingResults.consensus != null ? normalizeConsensus(existingResults.consensus) : null) ??
          (typeof existingResults.summary === 'string' ? normalizeConsensus(existingResults) : null)
      }

      /** Merge this tab's result into existing record; other tabs (logic/fact) stay unchanged. Do not persist 'logic' — only creative and fact. */
      const mergeTabIntoRecord = (prev: TabAnalysisRecord, result: string | null, tabKey: string) => {
        const next = { ...prev }
        if (result != null && String(result).trim().length > 0) next[tabKey] = String(result).trim()
        return Object.fromEntries(Object.entries(next).filter(([, v]) => String(v).trim().length > 0)) as TabAnalysisRecord
      }
      let nextGroq = mergeTabIntoRecord(prevGroq, groqResult, tab)
      let nextGemini = mergeTabIntoRecord(prevGemini, geminiResult, tab)
      if (tab === 'logic') {
        nextGroq = Object.fromEntries(Object.entries(nextGroq).filter(([k]) => k !== 'logic')) as TabAnalysisRecord
        nextGemini = Object.fromEntries(Object.entries(nextGemini).filter(([k]) => k !== 'logic')) as TabAnalysisRecord
      }

      // analysis_results: 새 JSON 포맷(Consensus)만 저장. Groq/Gemini 원본은 저장 금지. 생성된 결과가 있을 때만 업데이트.
      const consensusToSave = consensus ?? existingConsensus
      const upsertPayload: Record<string, unknown> = {
        user_id: cacheKey.userId,
        keyword: cacheKey.keyword,
        country_code: cacheKey.countryCode,
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

      logCacheEvent('write', {
        scope: CACHE_SCOPE,
        keyword,
        countryCode,
        tab,
        detail: consensusToSave != null ? 'analysis_and_consensus' : 'analysis_only',
      })
      await supabase.from('research_history').upsert(upsertPayload, {
        onConflict: 'user_id,keyword,country_code',
      })
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
  // Frontend: groqError / geminiQuotaExceeded + geminiError show in cards; error when both failed so user can retry.
  return NextResponse.json({
    groq: groqResult != null && groqResult.length > 0 ? { text: groqResult } : null,
    gemini: geminiResult != null && geminiResult.length > 0 ? { text: geminiResult } : null,
    ...(finalConsensus ? { consensus: finalConsensus } : {}),
    ...(groqQuotaError ? { groqError: GROQ_QUOTA_MESSAGE } : {}),
    ...(geminiQuotaExceeded ? { status: 'quota_exceeded', geminiQuotaExceeded: true, geminiError: RATE_LIMIT_USER_MESSAGE } : {}),
    ...(!hasAny ? { error: RATE_LIMIT_USER_MESSAGE } : {}),
  })
}
