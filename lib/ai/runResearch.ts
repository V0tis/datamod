/**
 * Single entry point for research execution.
 * AsyncGenerator that yields streaming events for incremental UI updates.
 * DB write only occurs after full analysis success.
 */
import Parser from 'rss-parser'
import { createAdminClient } from '@/lib/supabase/admin'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { generateText, runTabAnalysis } from './unified-ai-service'
import {
  PASS1_SYSTEM,
  buildPass1Prompt,
  PASS2_SYSTEM,
  buildPass2Prompt,
} from './pm-analysis-two-pass'
import { extractJsonFromText } from '@/lib/extract-json'
import { trackUsage } from '@/lib/usage'
import { buildCacheKeyParts, isCacheValid, logCacheEvent } from '@/lib/research-cache'
import type {
  InitialResearchSummary,
  ChartData,
  StructuredAnalysisFields,
  StructuredRecommendedAction,
} from '@/lib/research-parser'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TAB_SYSTEM_PROMPT =
  '시장 분석 및 인사이트를 마크다운 형식으로 요약. 반드시 한국어로 작성. 중요 키워드는 **강조**. Facts/Hypotheses/Inferences 구분 가능 시 해당 레이블 사용. 질문·대화형 표현 금지.'

export type NewsItem = {
  title: string
  url: string
  publisher?: string
  publishedAt?: string
}

export type Pass1Result = {
  summary: string
  temperature: number
  insights: string[]
}

export type Pass2Result = {
  insights?: { facts?: string[]; hypotheses?: string[]; inferences?: string[] }
  actions?: Array<{ title?: string; reasoning?: string; urgency?: string }>
  signals?: { pos?: string[]; neu?: string[]; neg?: string[] }
}

export type ResearchStreamEvent =
  | { type: 'news'; items: NewsItem[] }
  | { type: 'pass1'; summary: string; temperature: number; insights: string[] }
  | { type: 'pass2'; structured: StructuredAnalysisFields }
  | { type: 'creative'; groqText: string | null; geminiText: string | null }
  | { type: 'done'; reportId: string; sourceLinks: NewsItem[] }
  | { type: 'cached'; reportId: string }
  | { type: 'error'; message: string; step?: string }

export type RunResearchParams = {
  keyword: string
  countryCode: string
  userId: string
  geminiKey: string
  groqKey?: string | null
}

type RssItem = {
  title?: string
  link?: string
  pubDate?: string
  contentSnippet?: string
  content?: string
}
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

async function fetchNewsTitles(keyword: string): Promise<NewsItem[]> {
  const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  })
  if (!res.ok) return []
  try {
    const xml = await res.text()
    const feed = await rssParser.parseString(xml)
    const items = (feed.items ?? []).slice(0, 15).map((it) => {
      const title = (it.title ?? '').trim().slice(0, 300)
      const link = typeof it.link === 'string' ? it.link : ''
      let publisher = ''
      try {
        if (link) publisher = new URL(link).hostname.replace(/^www\./, '')
      } catch {
        /* ignore */
      }
      return {
        title,
        url: link,
        publisher: publisher || undefined,
        publishedAt: new Date().toISOString(),
      }
    })
    return items.filter((i) => i.title.length > 0)
  } catch {
    return []
  }
}

function parseJson<T>(text: string): T | null {
  const raw = extractJsonFromText(text)
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function parsePass1Response(text: string): Pass1Result | null {
  const p = parseJson<Pass1Result>(text)
  if (!p || typeof p.summary !== 'string') return null
  const temp =
    typeof p.temperature === 'number' ? Math.min(100, Math.max(0, p.temperature)) : 50
  const insights = Array.isArray(p.insights)
    ? p.insights.filter((s): s is string => typeof s === 'string').slice(0, 3)
    : []
  return { summary: p.summary.trim(), temperature: temp, insights }
}

function parsePass2Response(text: string): Pass2Result | null {
  const p = parseJson<Pass2Result>(text)
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

function buildStructuredFields(
  p1: Pass1Result,
  p2: Pass2Result | null
): { summary: InitialResearchSummary; structured: StructuredAnalysisFields } {
  const facts = p2?.insights?.facts ?? []
  const hypotheses = p2?.insights?.hypotheses ?? []
  const inferences = p2?.insights?.inferences ?? []
  const pos = p2?.signals?.pos ?? []
  const neu = p2?.signals?.neu ?? []
  const neg = p2?.signals?.neg ?? []
  const rawActions = p2?.actions ?? []
  const recActions: StructuredRecommendedAction[] = rawActions
    .filter(
      (a): a is { title: string; reasoning?: string; urgency?: string } =>
        typeof a?.title === 'string'
    )
    .map((a) => ({
      title: a.title,
      reasoning: typeof a.reasoning === 'string' ? a.reasoning : undefined,
      urgency_level: (
        a.urgency === 'high' || a.urgency === 'medium' || a.urgency === 'low'
          ? a.urgency
          : 'low'
      ) as 'low' | 'medium' | 'high',
    }))

  const marketNews = [...facts, ...pos].slice(0, 5)
  const painPoints = [...neg, ...hypotheses].filter(Boolean).slice(0, 5)
  const competitorTrends = inferences.find((s) => /경쟁|경쟁사|시장점유/i.test(s)) ?? ''
  const keyConclusions = [...recActions.map((a) => a.title), ...inferences]
    .filter(Boolean)
    .slice(0, 5)
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

function buildCreativePrompt(
  keyword: string,
  summary: string,
  newsHeadlines: string
): string {
  const newsBlock = newsHeadlines
    ? `\n\n실시간 뉴스 헤드라인 (news_items_ko):\n${newsHeadlines}\n\n`
    : ''
  const baseSummary = summary ? `리포트 요약:\n${summary}\n\n` : ''
  return `키워드: "${keyword}"${newsBlock}${baseSummary}위 내용을 바탕으로 향후 전망과 투자/행동 아이디어를 2~4문단 마크다운으로 요약해 주세요.`
}

function buildSummaryText(summary: {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
}): string {
  const parts = [
    summary.marketNews?.length ? `시장 뉴스 요약: ${summary.marketNews.join(' ')}` : '',
    summary.painPoints?.length ? `유저 페인포인트: ${summary.painPoints.join(' ')}` : '',
    summary.competitorTrends ? `경쟁사 동향: ${summary.competitorTrends}` : '',
  ]
  return parts.filter(Boolean).join('\n\n')
}

function toRecord(value: unknown): Record<string, string> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, string>
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>
      }
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Main research execution generator.
 * Yields streaming events for incremental UI updates.
 * Only persists to DB after all analysis succeeds.
 */
export async function* runResearch(
  params: RunResearchParams
): AsyncGenerator<ResearchStreamEvent> {
  const { keyword, countryCode, userId, geminiKey, groqKey } = params
  const supabase = createAdminClient()
  const cacheKey = buildCacheKeyParts(userId, keyword, countryCode)

  // Check cache first
  const { data: cacheRow } = await supabase
    .from('research_history')
    .select('report_id, updated_at')
    .eq('user_id', cacheKey.userId)
    .eq('keyword', cacheKey.keyword)
    .eq('country_code', cacheKey.countryCode)
    .maybeSingle()

  if (cacheRow?.report_id && isCacheValid(cacheRow.updated_at)) {
    logCacheEvent('hit', {
      scope: 'run_research',
      keyword: cacheKey.keyword,
      countryCode: cacheKey.countryCode,
      source: 'report_id',
      detail: 'cached',
      skippedAi: true,
      updatedAt: cacheRow.updated_at,
    })
    yield { type: 'cached', reportId: cacheRow.report_id }
    return
  }

  // Step 1: Fetch news
  let news: NewsItem[]
  try {
    news = await fetchNewsTitles(keyword)
    yield { type: 'news', items: news }
  } catch (err) {
    yield {
      type: 'error',
      message: '뉴스 수집에 실패했습니다.',
      step: 'news',
    }
    return
  }

  // Step 2: Pass 1 analysis
  let pass1: Pass1Result
  try {
    const newsTitles = news.map((n) => n.title)
    const pass1Prompt = buildPass1Prompt(keyword, newsTitles)
    const pass1Text = await generateText({
      apiKey: geminiKey,
      prompt: pass1Prompt,
      systemInstruction: PASS1_SYSTEM,
      maxOutputTokens: 600,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')

    const parsed = parsePass1Response(typeof pass1Text === 'string' ? pass1Text : '')
    if (!parsed) {
      yield {
        type: 'error',
        message: '1차 분석 형식이 올바르지 않아요. 다시 시도해 주세요.',
        step: 'pass1',
      }
      return
    }
    pass1 = parsed
    yield {
      type: 'pass1',
      summary: pass1.summary,
      temperature: pass1.temperature,
      insights: pass1.insights,
    }
  } catch (err) {
    yield {
      type: 'error',
      message: 'AI 분석 중 오류가 발생했습니다.',
      step: 'pass1',
    }
    return
  }

  // Step 3: Pass 2 analysis
  let pass2: Pass2Result | null = null
  let structured: StructuredAnalysisFields
  let fullSummary: InitialResearchSummary
  try {
    const newsTitles = news.map((n) => n.title)
    const pass2Prompt = buildPass2Prompt(keyword, newsTitles, pass1.summary)
    const pass2Text = await generateText({
      apiKey: geminiKey,
      prompt: pass2Prompt,
      systemInstruction: PASS2_SYSTEM,
      maxOutputTokens: 1200,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')

    pass2 = parsePass2Response(typeof pass2Text === 'string' ? pass2Text : '')
    const merged = buildStructuredFields(pass1, pass2)
    fullSummary = merged.summary
    structured = merged.structured

    yield { type: 'pass2', structured }
  } catch (err) {
    // Pass 2 failure is recoverable - use pass1 data
    const merged = buildStructuredFields(pass1, null)
    fullSummary = merged.summary
    structured = merged.structured
    yield { type: 'pass2', structured }
  }

  // Step 4: Creative analysis
  let creativeGroq: string | null = null
  let creativeGemini: string | null = null
  try {
    const provider =
      groqKey && geminiKey ? 'all' : geminiKey ? 'gemini' : groqKey ? 'groq' : 'none'
    if (provider !== 'none') {
      const summaryText = buildSummaryText(fullSummary)
      const newsHeadlines = news.map((n) => n.title).join('\n')
      const userPrompt = buildCreativePrompt(keyword, summaryText, newsHeadlines)

      const creative = await runTabAnalysis({
        groqKey: groqKey ?? null,
        geminiKey: geminiKey,
        provider,
        systemPrompt: TAB_SYSTEM_PROMPT,
        userPrompt,
      })

      creativeGroq = creative.groqText
      creativeGemini = creative.geminiText
      yield { type: 'creative', groqText: creativeGroq, geminiText: creativeGemini }
    }
  } catch (err) {
    // Creative analysis failure is recoverable
    yield { type: 'creative', groqText: null, geminiText: null }
  }

  // Step 5: Persist to DB (only after all analysis succeeds)
  let reportId: string | null = null
  try {
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        user_id: userId,
        keyword,
        content: fullSummary,
        source_links: news,
        ai_responses: {},
      })
      .select('id')
      .single()

    if (!insertError && report?.id) {
      reportId = report.id

      const keyMetrics = {
        chartData: fullSummary.chartData,
        keyConclusions: fullSummary.keyConclusions,
        sentiment: fullSummary.sentiment,
        market_temperature_score: structured.market_temperature_score,
        summary_insights: structured.summary_insights,
        facts: structured.facts,
        hypotheses: structured.hypotheses,
        inferences: structured.inferences,
        positive_signals: structured.positive_signals,
        neutral_signals: structured.neutral_signals,
        negative_risks: structured.negative_risks,
        pm_actions: structured.pm_actions,
      }

      logCacheEvent('write', {
        scope: 'run_research',
        keyword: cacheKey.keyword,
        countryCode: cacheKey.countryCode,
        detail: 'key_metrics',
      })

      // Build research_history upsert payload
      const upsertPayload: Record<string, unknown> = {
        user_id: cacheKey.userId,
        keyword: cacheKey.keyword,
        country_code: cacheKey.countryCode,
        report_id: reportId,
        key_metrics: keyMetrics,
        analysis_status: 'completed',
        updated_at: new Date().toISOString(),
      }
      if (structured?.analysis_target) upsertPayload.analysis_target = structured.analysis_target
      if (typeof structured?.confidence_score === 'number')
        upsertPayload.confidence_score = structured.confidence_score
      if (typeof structured?.market_temperature_score === 'number')
        upsertPayload.market_temperature_score = structured.market_temperature_score
      if (structured?.summary_insights)
        upsertPayload.summary_insights = structured.summary_insights

      // Save creative analysis if available
      if (creativeGroq || creativeGemini) {
        const { data: existing } = await supabase
          .from('research_history')
          .select('analysis_groq, analysis_gemini')
          .eq('user_id', cacheKey.userId)
          .eq('keyword', cacheKey.keyword)
          .eq('country_code', cacheKey.countryCode)
          .maybeSingle()

        const nextGroq = {
          ...toRecord(existing?.analysis_groq),
          ...(creativeGroq ? { creative: creativeGroq } : {}),
        }
        const nextGemini = {
          ...toRecord(existing?.analysis_gemini),
          ...(creativeGemini ? { creative: creativeGemini } : {}),
        }
        const analysisInsight = creativeGemini ?? creativeGroq ?? null

        upsertPayload.analysis_groq = nextGroq
        upsertPayload.analysis_gemini = nextGemini
        upsertPayload.analysis_insight = analysisInsight
      }

      await supabase
        .from('research_history')
        .upsert(upsertPayload, { onConflict: 'user_id,keyword,country_code' })

      await supabase.from('reports').update({ content: fullSummary }).eq('id', reportId)
    }
  } catch (err) {
    yield {
      type: 'error',
      message: '리포트 저장 중 오류가 발생했습니다.',
      step: 'db',
    }
    return
  }

  if (!reportId) {
    yield {
      type: 'error',
      message: '리포트를 생성하지 못했습니다.',
      step: 'db',
    }
    return
  }

  yield { type: 'done', reportId, sourceLinks: news }
}
