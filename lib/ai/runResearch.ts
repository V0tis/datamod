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
  OPPORTUNITY_SCORE_SYSTEM,
  buildOpportunityScorePrompt,
  TASK_TRENDS_SYSTEM,
  buildTaskTrendsPrompt,
  TASK_COMPETITION_SYSTEM,
  buildTaskCompetitionPrompt,
  STRATEGY_LAYER_SYSTEM,
  buildStrategyLayerPrompt,
  EXECUTION_LAYER_SYSTEM,
  buildExecutionLayerPrompt,
} from './pm-strategic-prompt'
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

/** Product Strategy Engine stage IDs - layered analysis */
export type AnalysisTaskId =
  | 'signal_layer'
  | 'trend_analysis'
  | 'competition_analysis'
  | 'strategy_generation'
  | 'execution_layer'

export type TaskCompletedPayload = {
  signal_layer?: { signals: string[]; news_activity?: Array<{ title: string; url?: string; publisher?: string }> }
  trend_analysis?: { trend_summary: string; market_temperature_score: number; growth_signals?: string[] }
  competition_analysis?: { competitive_landscape: Array<{ name: string; positioning?: string }>; market_structure?: string }
  strategy_generation?: { opportunities: string[]; risks: string[]; strategy_summary: string }
  execution_layer?: { product_actions: Array<{ action: string; priority?: string; reasoning?: string }>; feature_ideas?: string[]; go_to_market_steps?: string[] }
}

const ANALYSIS_TASK_STEPS: AnalysisTaskId[] = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'strategy_generation',
  'execution_layer',
]

export type ResearchStreamEvent =
  | { type: 'analysis_started'; analysisId: string }
  | { type: 'task'; task: AnalysisTaskId; status: 'running' | 'completed' | 'failed'; data?: TaskCompletedPayload[AnalysisTaskId]; error?: string }
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

type ValidationError = {
  field: string
  message: string
}

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] }

function parseJson<T>(text: string): T | null {
  const raw = extractJsonFromText(text)
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function validatePass1(data: unknown): ValidationResult<Pass1Result> {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    return { success: false, errors: [{ field: 'root', message: '응답이 유효한 객체가 아닙니다.' }] }
  }

  const obj = data as Record<string, unknown>

  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    errors.push({ field: 'summary', message: '요약이 비어있거나 문자열이 아닙니다.' })
  }

  const temp = typeof obj.temperature === 'number'
    ? Math.min(100, Math.max(0, obj.temperature))
    : 50

  if (typeof obj.temperature !== 'number') {
    errors.push({ field: 'temperature', message: '온도 값이 숫자가 아닙니다. 기본값(50)을 사용합니다.' })
  }

  const insights = Array.isArray(obj.insights)
    ? obj.insights.filter((s): s is string => typeof s === 'string').slice(0, 5)
    : []

  if (!Array.isArray(obj.insights) || insights.length === 0) {
    errors.push({ field: 'insights', message: '인사이트 배열이 비어있거나 유효하지 않습니다.' })
  }

  if (errors.some((e) => e.field === 'summary')) {
    return { success: false, errors }
  }

  return {
    success: true,
    data: {
      summary: (obj.summary as string).trim(),
      temperature: temp,
      insights,
    },
  }
}

function validatePass2(data: unknown): ValidationResult<Pass2Result> {
  if (!data || typeof data !== 'object') {
    return { success: false, errors: [{ field: 'root', message: '응답이 유효한 객체가 아닙니다.' }] }
  }

  const obj = data as Record<string, unknown>
  const result: Pass2Result = {}

  if (obj.insights && typeof obj.insights === 'object') {
    const ins = obj.insights as Record<string, unknown>
    result.insights = {
      facts: Array.isArray(ins.facts) ? ins.facts.filter((s): s is string => typeof s === 'string') : [],
      hypotheses: Array.isArray(ins.hypotheses) ? ins.hypotheses.filter((s): s is string => typeof s === 'string') : [],
      inferences: Array.isArray(ins.inferences) ? ins.inferences.filter((s): s is string => typeof s === 'string') : [],
    }
  }

  if (Array.isArray(obj.actions)) {
    result.actions = obj.actions
      .filter((a): a is object => a != null && typeof a === 'object')
      .map((a) => {
        const act = a as Record<string, unknown>
        return {
          title: typeof act.title === 'string' ? act.title : undefined,
          reasoning: typeof act.reasoning === 'string' ? act.reasoning : undefined,
          urgency: typeof act.urgency === 'string' ? act.urgency : undefined,
        }
      })
      .filter((a) => a.title)
  }

  if (obj.signals && typeof obj.signals === 'object') {
    const sig = obj.signals as Record<string, unknown>
    result.signals = {
      pos: Array.isArray(sig.pos) ? sig.pos.filter((s): s is string => typeof s === 'string') : [],
      neu: Array.isArray(sig.neu) ? sig.neu.filter((s): s is string => typeof s === 'string') : [],
      neg: Array.isArray(sig.neg) ? sig.neg.filter((s): s is string => typeof s === 'string') : [],
    }
  }

  return { success: true, data: result }
}

function parsePass1Response(text: string): Pass1Result | null {
  const parsed = parseJson<unknown>(text)
  if (!parsed) return null
  const validation = validatePass1(parsed)
  return validation.success ? validation.data : null
}

function parsePass2Response(text: string): Pass2Result | null {
  const parsed = parseJson<unknown>(text)
  if (!parsed) return null
  const validation = validatePass2(parsed)
  return validation.success ? validation.data : null
}

/** Strategic prompt output shape */
type StrategicAnalysisResult = {
  market_score?: number
  market_phase?: string
  confidence_level?: string
  summary?: string
  signal_breakdown?: {
    positive_signals?: Array<{ signal?: string; impact?: string; explanation?: string }>
    neutral_signals?: Array<{ signal?: string; impact?: string; explanation?: string }>
    risk_signals?: Array<{ signal?: string; severity?: string; explanation?: string }>
  }
  market_structure?: { summary?: string }
  competitive_landscape?: Array<{ name?: string; positioning?: string; strength?: string; weakness?: string }>
  strategic_actions?: {
    immediate?: Array<{ action?: string; priority?: string; expected_impact?: string }>
    mid_term?: Array<{ action?: string; priority?: string; expected_impact?: string }>
    risk_mitigation?: Array<{ action?: string; priority?: string; risk_addressed?: string }>
  }
  key_uncertainties?: string[]
  full_report?: string
}

function parseStrategicResponse(text: string): StrategicAnalysisResult | null {
  const parsed = parseJson<StrategicAnalysisResult>(text)
  if (!parsed || typeof parsed !== 'object') return null
  if (typeof parsed.market_score !== 'number' && typeof parsed.summary !== 'string') return null
  return parsed
}

function buildStructuredFromStrategic(
  s: StrategicAnalysisResult
): { pass1: Pass1Result; summary: InitialResearchSummary; structured: StructuredAnalysisFields } {
  const score = typeof s.market_score === 'number' ? Math.min(100, Math.max(0, s.market_score)) : 50
  const summaryText = typeof s.summary === 'string' ? s.summary : '분석 완료'
  const pos = (s.signal_breakdown?.positive_signals ?? []).map((x) => (typeof x.signal === 'string' ? x.signal : '')).filter(Boolean)
  const neu = (s.signal_breakdown?.neutral_signals ?? []).map((x) => (typeof x.signal === 'string' ? x.signal : '')).filter(Boolean)
  const neg = (s.signal_breakdown?.risk_signals ?? []).map((x) => (typeof x.signal === 'string' ? x.signal : '')).filter(Boolean)

  const allActions: StructuredRecommendedAction[] = []
  const addActions = (arr: Array<{ action?: string; priority?: string; expected_impact?: string; risk_addressed?: string }> | undefined) => {
    if (!Array.isArray(arr)) return
    arr.forEach((a) => {
      const title = typeof a.action === 'string' ? a.action : ''
      if (title) {
        allActions.push({
          title,
          reasoning: typeof a.expected_impact === 'string' ? a.expected_impact : typeof a.risk_addressed === 'string' ? a.risk_addressed : undefined,
          urgency_level: (a.priority === 'high' || a.priority === 'medium' || a.priority === 'low' ? a.priority : 'medium') as 'low' | 'medium' | 'high',
        })
      }
    })
  }
  addActions(s.strategic_actions?.immediate)
  addActions(s.strategic_actions?.mid_term)
  addActions(s.strategic_actions?.risk_mitigation)

  const competitorSummary = (s.competitive_landscape ?? [])
    .map((c) => c.name && c.positioning ? `${c.name}: ${c.positioning}` : c.name)
    .filter(Boolean)
    .join('. ')
  const marketStructureSummary = s.market_structure?.summary ?? ''

  const pass1: Pass1Result = {
    summary: summaryText,
    temperature: score,
    insights: [...pos, ...neg].slice(0, 5),
  }

  const summary: InitialResearchSummary = {
    marketNews: pos.slice(0, 5),
    painPoints: neg.slice(0, 5),
    competitorTrends: competitorSummary || marketStructureSummary,
    sentiment: score,
    publicReactionTrends: [...pos, ...neu, ...neg].join('. ').slice(0, 500),
    chartData: defaultChartData(),
    articleSummaries: [],
    keyConclusions: allActions.slice(0, 5).map((a) => a.title),
  }

  const structured: StructuredAnalysisFields = {
    market_temperature_score: score,
    summary_insights: summaryText,
    facts: pos.length ? pos : undefined,
    hypotheses: (s.key_uncertainties ?? []).slice(0, 3),
    inferences: neg.length ? neg : undefined,
    positive_signals: pos.length ? pos : undefined,
    neutral_signals: neu.length ? neu : undefined,
    negative_risks: neg.length ? neg : undefined,
    pm_actions: {
      recommended_actions: allActions,
      monitoring_points: s.key_uncertainties ?? [],
      decision_risks: neg,
    },
    strategic_actions: s.strategic_actions,
    competitive_landscape: (s.competitive_landscape ?? []).filter(
      (c): c is { name: string; positioning?: string; strength?: string; weakness?: string } =>
        typeof c.name === 'string' && c.name.trim().length > 0
    ),
    market_structure: s.market_structure
      ? { competition_density: (s.market_structure as { competition_density?: string }).competition_density, summary: s.market_structure.summary }
      : undefined,
    market_phase: typeof s.market_phase === 'string' ? s.market_phase : undefined,
  }

  return { pass1, summary, structured }
}

const FALLBACK_PASS1: Pass1Result = {
  summary: '분석 중 일부 데이터를 처리하지 못했습니다. 다시 시도해 주세요.',
  temperature: 50,
  insights: ['데이터 수집 완료', '분석 진행 중'],
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

  const analysisId = `${cacheKey.userId}|${cacheKey.keyword}|${cacheKey.countryCode}`

  const upsertAnalysisTask = async (
    step: AnalysisTaskId,
    status: 'pending' | 'running' | 'completed' | 'failed',
    opts?: { outputData?: unknown; errorMessage?: string }
  ) => {
    const now = new Date().toISOString()
    await supabase
      .from('analysis_tasks')
      .upsert(
        {
          analysis_id: analysisId,
          step_name: step,
          status,
          started_at: status === 'running' || status === 'completed' || status === 'failed' ? now : null,
          completed_at: status === 'completed' || status === 'failed' ? now : null,
          output_data: opts?.outputData ?? null,
          error_message: opts?.errorMessage ?? null,
          updated_at: now,
        },
        { onConflict: 'analysis_id,step_name' }
      )
  }

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

  const updateProgress = async (step: number, status: 'analyzing' | 'completed' | 'failed') => {
    await supabase
      .from('research_history')
      .upsert(
        {
          user_id: cacheKey.userId,
          keyword: cacheKey.keyword,
          country_code: cacheKey.countryCode,
          analysis_status: status,
          progress_step: status === 'completed' ? null : step,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,keyword,country_code' }
      )
  }

  await updateProgress(0, 'analyzing')
  yield { type: 'analysis_started', analysisId }

  // Layer 1: Signal Layer - collect market signals
  await upsertAnalysisTask('signal_layer', 'running')
  yield { type: 'task', task: 'signal_layer', status: 'running' }
  let news: NewsItem[]
  try {
    news = await fetchNewsTitles(keyword)
    const publishers = [...new Set(news.map((n) => n.publisher).filter(Boolean))] as string[]
    const signalSources = publishers.length > 0 ? publishers : ['Google News', 'RSS 피드']
    const signalData = {
      signals: signalSources,
      news_activity: news.map((n) => ({ title: n.title, url: n.url, publisher: n.publisher })),
    }
    await upsertAnalysisTask('signal_layer', 'completed', { outputData: signalData })
    await updateProgress(1, 'analyzing')
    yield {
      type: 'task',
      task: 'signal_layer',
      status: 'completed',
      data: signalData,
    }
    yield { type: 'news', items: news }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '시장 신호 수집에 실패했습니다.'
    await upsertAnalysisTask('signal_layer', 'failed', { errorMessage: msg })
    await updateProgress(0, 'failed')
    yield { type: 'task', task: 'signal_layer', status: 'failed', error: msg }
    yield { type: 'error', message: msg, step: 'signal_layer' }
    return
  }

  const newsTitles = news.map((n) => n.title)

  // Layer 2: Analysis Layer - Trend detection
  await upsertAnalysisTask('trend_analysis', 'running')
  yield { type: 'task', task: 'trend_analysis', status: 'running' }
  let trendData: { summary: string; market_score: number; positive_signals: string[]; neutral_signals: string[] }
  try {
    const trendText = await generateText({
      apiKey: geminiKey,
      prompt: buildTaskTrendsPrompt(keyword, newsTitles),
      systemInstruction: TASK_TRENDS_SYSTEM,
      maxOutputTokens: 800,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')
    const parsed = parseJson<{ market_score?: number; summary?: string; positive_signals?: string[]; neutral_signals?: string[] }>(
      typeof trendText === 'string' ? trendText : ''
    )
    if (!parsed || (typeof parsed.market_score !== 'number' && typeof parsed.summary !== 'string')) {
      throw new Error('Invalid trend response')
    }
    trendData = {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '트렌드 분석 완료',
      market_score: typeof parsed.market_score === 'number' ? Math.min(100, Math.max(0, parsed.market_score)) : 50,
      positive_signals: Array.isArray(parsed.positive_signals) ? parsed.positive_signals.filter((s): s is string => typeof s === 'string') : [],
      neutral_signals: Array.isArray(parsed.neutral_signals) ? parsed.neutral_signals.filter((s): s is string => typeof s === 'string') : [],
    }
    const trendPayload = {
      trend_summary: trendData.summary,
      market_temperature_score: trendData.market_score,
      growth_signals: [...trendData.positive_signals, ...trendData.neutral_signals].slice(0, 5),
    }
    await upsertAnalysisTask('trend_analysis', 'completed', { outputData: trendPayload })
    await updateProgress(2, 'analyzing')
    yield {
      type: 'task',
      task: 'trend_analysis',
      status: 'completed',
      data: trendPayload,
    }
    yield {
      type: 'pass1',
      summary: trendData.summary,
      temperature: trendData.market_score,
      insights: trendData.positive_signals,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '트렌드 분석 중 오류가 발생했습니다.'
    await upsertAnalysisTask('trend_analysis', 'failed', { errorMessage: msg })
    await updateProgress(2, 'failed')
    yield { type: 'task', task: 'trend_analysis', status: 'failed', error: msg }
    yield { type: 'error', message: msg, step: 'trend_analysis' }
    return
  }

  // Layer 3: Analysis Layer - Competition mapping
  await upsertAnalysisTask('competition_analysis', 'running')
  yield { type: 'task', task: 'competition_analysis', status: 'running' }
  let competitionData: { competitive_landscape: Array<{ name: string; positioning?: string }>; market_structure?: string }
  try {
    const compText = await generateText({
      apiKey: geminiKey,
      prompt: buildTaskCompetitionPrompt(keyword, trendData.summary),
      systemInstruction: TASK_COMPETITION_SYSTEM,
      maxOutputTokens: 600,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')
    const parsed = parseJson<{
      competitive_landscape?: Array<{ name?: string; positioning?: string }>
      market_structure?: { summary?: string }
    }>(typeof compText === 'string' ? compText : '')
    const landscape = Array.isArray(parsed?.competitive_landscape)
      ? parsed.competitive_landscape
          .filter((c): c is { name: string; positioning?: string } => typeof c?.name === 'string')
          .slice(0, 10)
      : []
    competitionData = {
      competitive_landscape: landscape,
      market_structure: typeof parsed?.market_structure?.summary === 'string' ? parsed.market_structure.summary : undefined,
    }
    await upsertAnalysisTask('competition_analysis', 'completed', { outputData: competitionData })
    await updateProgress(3, 'analyzing')
    yield {
      type: 'task',
      task: 'competition_analysis',
      status: 'completed',
      data: competitionData,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '경쟁 환경 분석 중 오류가 발생했습니다.'
    await upsertAnalysisTask('competition_analysis', 'failed', { errorMessage: msg })
    await updateProgress(3, 'failed')
    yield { type: 'task', task: 'competition_analysis', status: 'failed', error: msg }
    yield { type: 'error', message: msg, step: 'competition_analysis' }
    return
  }

  const competitionSummary = competitionData.competitive_landscape
    .map((c) => (c.positioning ? `${c.name}: ${c.positioning}` : c.name))
    .join('. ') || competitionData.market_structure || ''

  // Layer 4: Strategy Layer - opportunities, risks, strategy summary
  await upsertAnalysisTask('strategy_generation', 'running')
  yield { type: 'task', task: 'strategy_generation', status: 'running' }
  let strategyData: { opportunities: string[]; risks: string[]; strategy_summary: string }
  try {
    const stratText = await generateText({
      apiKey: geminiKey,
      prompt: buildStrategyLayerPrompt(keyword, trendData.summary, competitionSummary),
      systemInstruction: STRATEGY_LAYER_SYSTEM,
      maxOutputTokens: 600,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')
    const parsed = parseJson<{ opportunities?: string[]; risks?: string[]; strategy_summary?: string }>(
      typeof stratText === 'string' ? stratText : ''
    )
    strategyData = {
      opportunities: Array.isArray(parsed?.opportunities) ? parsed.opportunities.filter((s): s is string => typeof s === 'string') : trendData.positive_signals,
      risks: Array.isArray(parsed?.risks) ? parsed.risks.filter((s): s is string => typeof s === 'string') : [],
      strategy_summary: typeof parsed?.strategy_summary === 'string' ? parsed.strategy_summary : trendData.summary,
    }
    await upsertAnalysisTask('strategy_generation', 'completed', { outputData: strategyData })
    await updateProgress(4, 'analyzing')
    yield {
      type: 'task',
      task: 'strategy_generation',
      status: 'completed',
      data: strategyData,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '전략 생성 중 오류가 발생했습니다.'
    await upsertAnalysisTask('strategy_generation', 'failed', { errorMessage: msg })
    await updateProgress(4, 'failed')
    yield { type: 'task', task: 'strategy_generation', status: 'failed', error: msg }
    yield { type: 'error', message: msg, step: 'strategy_generation' }
    return
  }

  const strategyContext = [strategyData.strategy_summary, strategyData.opportunities.join('. '), strategyData.risks.join('. ')].filter(Boolean).join('\n')

  // Layer 5: Execution Layer - product actions, feature ideas, GTM steps
  await upsertAnalysisTask('execution_layer', 'running')
  yield { type: 'task', task: 'execution_layer', status: 'running' }
  let executionData: {
    product_actions: Array<{ action: string; priority?: string; reasoning?: string }>
    feature_ideas: string[]
    go_to_market_steps: string[]
  }
  try {
    const execText = await generateText({
      apiKey: geminiKey,
      prompt: buildExecutionLayerPrompt(
        keyword,
        strategyData.strategy_summary,
        strategyData.opportunities.join('. '),
        strategyData.risks.join('. ')
      ),
      systemInstruction: EXECUTION_LAYER_SYSTEM,
      maxOutputTokens: 800,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')
    const parsed = parseJson<{
      product_actions?: Array<{ action?: string; priority?: string; reasoning?: string }>
      feature_ideas?: string[]
      go_to_market_steps?: string[]
    }>(typeof execText === 'string' ? execText : '')
    const actions = Array.isArray(parsed?.product_actions)
      ? parsed.product_actions
          .filter((a): a is { action: string; priority?: string; reasoning?: string } => typeof (a as { action?: string })?.action === 'string')
          .map((a) => ({ action: (a as { action: string }).action, priority: a.priority, reasoning: a.reasoning }))
      : []
    executionData = {
      product_actions: actions,
      feature_ideas: Array.isArray(parsed?.feature_ideas) ? parsed.feature_ideas.filter((s): s is string => typeof s === 'string') : [],
      go_to_market_steps: Array.isArray(parsed?.go_to_market_steps) ? parsed.go_to_market_steps.filter((s): s is string => typeof s === 'string') : [],
    }
    await upsertAnalysisTask('execution_layer', 'completed', { outputData: executionData })
    await updateProgress(5, 'analyzing')
    yield {
      type: 'task',
      task: 'execution_layer',
      status: 'completed',
      data: executionData,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '전략 실행 생성 중 오류가 발생했습니다.'
    await upsertAnalysisTask('execution_layer', 'failed', { errorMessage: msg })
    executionData = {
      product_actions: [],
      feature_ideas: [],
      go_to_market_steps: [],
    }
  }

  const pos = trendData.positive_signals
  const neu = trendData.neutral_signals
  const neg = strategyData.risks
  const allActions: StructuredRecommendedAction[] = executionData.product_actions.map((a) => ({
    title: a.action,
    reasoning: a.reasoning,
    urgency_level: (a.priority === 'high' || a.priority === 'medium' ? a.priority : 'medium') as 'low' | 'medium' | 'high',
  }))

  const keyConclusions = [
    ...allActions.slice(0, 3).map((a) => a.title),
    ...executionData.feature_ideas.slice(0, 2),
    ...executionData.go_to_market_steps.slice(0, 2),
  ].filter(Boolean)

  const fullSummary: InitialResearchSummary = {
    marketNews: pos.slice(0, 5),
    painPoints: neg.slice(0, 5),
    competitorTrends: competitionSummary,
    sentiment: trendData.market_score,
    publicReactionTrends: [...pos, ...neu, ...neg].join('. ').slice(0, 500),
    chartData: defaultChartData(),
    articleSummaries: [],
    keyConclusions: keyConclusions.slice(0, 5),
  }

  const structured: StructuredAnalysisFields = {
    market_temperature_score: trendData.market_score,
    summary_insights: strategyData.strategy_summary,
    facts: pos.length ? pos : undefined,
    hypotheses: strategyData.risks.slice(0, 3),
    inferences: neg.length ? neg : undefined,
    positive_signals: pos.length ? pos : undefined,
    neutral_signals: neu.length ? neu : undefined,
    negative_risks: neg.length ? neg : undefined,
    pm_actions: {
      recommended_actions: allActions,
      monitoring_points: strategyData.risks,
      decision_risks: neg,
    },
    strategic_actions: {
      immediate: executionData.product_actions.filter((a) => a.priority === 'high').map((a) => ({ action: a.action, priority: 'high' as const, expected_impact: a.reasoning })),
      mid_term: executionData.product_actions.filter((a) => a.priority === 'medium').map((a) => ({ action: a.action, priority: 'medium' as const, expected_impact: a.reasoning })),
      risk_mitigation: [],
    },
    competitive_landscape: competitionData.competitive_landscape.map((c) => ({
      name: c.name,
      positioning: c.positioning,
      strength: undefined,
      weakness: undefined,
    })),
    market_structure: competitionData.market_structure
      ? { competition_density: undefined, summary: competitionData.market_structure }
      : undefined,
  }

  yield { type: 'pass2', structured }

  // Opportunity Score - PM market attractiveness
  type ScoreBreakdown = {
    market_growth?: number
    competition_density?: number
    trend_momentum?: number
    funding_signals?: number
    risk_factors?: number
  }
  let opportunityScoreData: {
    opportunity_score: number
    score_reasoning: string
    breakdown: ScoreBreakdown
  } | null = null
  try {
    const scoreText = await generateText({
      apiKey: geminiKey,
      prompt: buildOpportunityScorePrompt(
        keyword,
        trendData.summary,
        competitionSummary,
        strategyData.opportunities.join('. '),
        strategyData.risks.join('. ')
      ),
      systemInstruction: OPPORTUNITY_SCORE_SYSTEM,
      maxOutputTokens: 500,
      model: GEMINI_MODEL,
    })
    await trackUsage('gemini')
    const parsed = parseJson<{
      opportunity_score?: number
      market_growth?: number
      competition_density?: number
      trend_momentum?: number
      funding_signals?: number
      risk_factors?: number
      score_reasoning?: string
    }>(typeof scoreText === 'string' ? scoreText : '')
    if (parsed && typeof parsed.opportunity_score === 'number') {
      const clampScore = (n: number) => Math.min(100, Math.max(0, n))
      const breakdown: ScoreBreakdown = {}
      if (typeof parsed.market_growth === 'number') breakdown.market_growth = parsed.market_growth
      if (typeof parsed.competition_density === 'number') breakdown.competition_density = parsed.competition_density
      if (typeof parsed.trend_momentum === 'number') breakdown.trend_momentum = parsed.trend_momentum
      if (typeof parsed.funding_signals === 'number') breakdown.funding_signals = parsed.funding_signals
      if (typeof parsed.risk_factors === 'number') breakdown.risk_factors = parsed.risk_factors
      opportunityScoreData = {
        opportunity_score: clampScore(parsed.opportunity_score),
        score_reasoning: typeof parsed.score_reasoning === 'string' ? parsed.score_reasoning : '',
        breakdown,
      }
    }
  } catch {
    /* recoverable */
  }

  if (opportunityScoreData) {
    structured.opportunity_score = opportunityScoreData.opportunity_score
    structured.opportunity_score_breakdown = opportunityScoreData.breakdown
    structured.opportunity_score_reasoning = opportunityScoreData.score_reasoning
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
      await updateProgress(5, 'analyzing')
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
        ...structured,
        chartData: fullSummary.chartData,
        keyConclusions: fullSummary.keyConclusions,
        sentiment: fullSummary.sentiment,
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
        progress_step: null,
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
    await updateProgress(5, 'failed')
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
