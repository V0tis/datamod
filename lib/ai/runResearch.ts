/**
 * Single entry point for research execution.
 * AsyncGenerator that yields streaming events for incremental UI updates.
 * DB write only occurs after full analysis success.
 */
import Parser from 'rss-parser'
import type { SupabaseClient } from '@supabase/supabase-js'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { BASE_MARKDOWN_PROMPT } from './base-prompt'
import { generateText, runTabAnalysis, completeChat } from './unified-ai-service'
import {
  TASK_TRENDS_SYSTEM,
  buildTaskTrendsPrompt,
  TASK_COMPETITION_SYSTEM,
  buildTaskCompetitionPromptFromNews,
  type ArticleForAnalysis,
} from './pm-strategic-prompt'
import { extractArticleContent, type ArticleWithContent } from './article-extract'
import {
  INSIGHT_EXTRACTION_SYSTEM,
  buildInsightExtractionPrompt,
  STRATEGIC_RECOMMENDATION_SYSTEM,
  buildStrategicRecommendationPrompt,
  PM_ACTION_PLAN_SYSTEM,
  buildPMActionPlanPrompt,
  STRATEGY_EVALUATION_SYSTEM,
  buildStrategyEvaluationPrompt,
} from './pipeline-prompts'
import { safeParseAiJson } from '@/lib/ai/safe-json-parse'
import { RATE_LIMIT_GRACEFUL_MESSAGE } from '@/lib/api/rate-limit'
import { is429OrQuotaError, isFallbackTriggerError, getFallbackErrorReason, sleep, getExponentialDelayMs } from './retry-with-backoff'
import { computeOpportunityScore } from './opportunity-score-formula'
import { buildChartDataFromAnalysis } from './chart-data-utils'
import { sanitizeDeep, sanitizeStringArray, sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { hasNonKoreanContent, ensureKoreanText } from '@/lib/ai/language-validate'

const AI_BASE_DELAY_MS = 1000
const AI_MAX_RETRIES = 2

function logAiError(provider: string, step: string, reason: string, retryAttempt: number, err: unknown) {
  console.log('[AI Error]', {
    provider,
    step,
    reason,
    retry_attempt: retryAttempt,
    max_retries: AI_MAX_RETRIES,
    message: err instanceof Error ? err.message : String(err),
  })
}

function toUserFriendlyError(err: unknown, fallback: string): string {
  if (is429OrQuotaError(err)) return RATE_LIMIT_GRACEFUL_MESSAGE
  return err instanceof Error ? err.message : fallback
}
import { trackUsage } from '@/lib/usage'
import { buildCacheKeyParts, isCacheValid, logCacheEvent } from '@/lib/research-cache'
import {
  loadPipelineResumeState,
  type CompetitionDataShape,
  type TrendDataShape,
  type PipelineResumeState,
} from '@/lib/ai/pipeline-resume'
import { searchWeb, formatWebContext } from '@/lib/web-search'
import type {
  InitialResearchSummary,
  ChartData,
  StructuredAnalysisFields,
  StructuredRecommendedAction,
  PMActionPlanItem,
} from '@/lib/research-parser'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TAB_SYSTEM_PROMPT = `${BASE_MARKDOWN_PROMPT}

PM 의사결정 지원용 요약입니다. 챗봇이 아닙니다. 컨설팅 보고서 수준으로, 한국 PM이 읽는 문서처럼 작성하세요.
포함할 내용: 상황 설명, 의미, 비즈니스 영향, 기회, 리스크, 전략 제안, 액션 제안. 단순 요약 금지.
Facts/Hypotheses/Inferences 구분 가능 시 해당 레이블 사용. 캐주얼·대화체·뉴스 요약 톤 금지.`

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

/** Product Strategy Engine - 5-step pipeline (each outputs structured JSON) */
export type AnalysisTaskId =
  | 'signal_layer'
  | 'trend_analysis'      // Step 1: Market Research
  | 'competition_analysis' // Step 2: Competitor Analysis
  | 'insight_extraction'   // Step 3: Insight Extraction
  | 'strategy_generation'  // Step 4: Strategic Recommendation
  | 'execution_layer'      // Step 5: PM Action Plan
  | 'risk_opportunity'     // Step 6: Risk & Opportunity Evaluation

export type TaskCompletedPayload = {
  signal_layer?: { signals: string[]; news_activity?: Array<{ title: string; url?: string; publisher?: string }> }
  trend_analysis?: { trend_summary: string; market_temperature_score: number; growth_signals?: string[] }
  competition_analysis?: { competitive_landscape: Array<{ name: string; positioning?: string }>; market_structure?: string }
  insight_extraction?: { key_insights: string[]; opportunity_signals: string[]; risk_signals: string[] }
  strategy_generation?: { opportunities: string[]; risks: string[]; strategy_summary: string; market_summary?: string; key_strategic_insights?: string[] }
  execution_layer?: {
    product_actions: Array<{ action: string; priority?: string; reasoning?: string }>
    feature_ideas?: string[]
    go_to_market_steps?: string[]
    pm_action_plan?: PMActionPlanItem[]
    next_actions_pm?: Array<{ action: string; why?: string; how_to_execute?: string; priority?: 'high' | 'medium' | 'low'; estimated_effort?: string }>
  }
  risk_opportunity?: StrategyEvaluationResult
}

const ANALYSIS_TASK_STEPS: AnalysisTaskId[] = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
  'risk_opportunity',
]

export type AnalysisStepProvider = 'gemini' | 'groq'

export type PostProcessingStepId = 'key_metrics' | 'creative' | 'saving'

export type ResearchStreamEvent =
  | { type: 'analysis_started'; analysisId: string }
  | { type: 'task'; task: AnalysisTaskId | 'article_extraction' | 'article_summary'; status: 'running' | 'completed' | 'failed'; data?: TaskCompletedPayload[AnalysisTaskId]; error?: string; fallbackMessage?: string; retryMessage?: string; retryAttempt?: number; provider?: AnalysisStepProvider | null; fallback_used?: boolean; primaryProviderError?: string; currentArticleTitle?: string }
  | { type: 'news'; items: NewsItem[] }
  | { type: 'pass1'; summary: string; temperature: number; insights: string[] }
  | { type: 'pass2'; structured: StructuredAnalysisFields }
  | { type: 'post_processing'; stepId: PostProcessingStepId }
  | { type: 'creative'; groqText: string | null; geminiText: string | null }
  | { type: 'done'; reportId: string; sourceLinks: NewsItem[]; analysis_depth?: 'fast' | 'standard' | 'deep'; serper_used?: boolean }
  | { type: 'cached'; reportId: string }
  | { type: 'error'; message: string; step?: string }
  | { type: 'pipeline_resume'; phase: 2 | 3; skippedSteps: string[]; message: string }

export type AIPrimaryModel = 'gemini' | 'groq'

export type RunResearchParams = {
  /** 서버에서 만든 Supabase 클라이언트(세션). 서비스 롤 없이 RLS로 동작하려면 마이그레이션 049 필요 */
  supabase: SupabaseClient
  keyword: string
  countryCode: string
  userId: string
  geminiKey: string
  groqKey?: string | null
  /** Serper API key for web search (user settings or env fallback) */
  serperKey?: string | null
  /** 분석 깊이: quick(빠른 인사이트), standard(전체 리포트), deep(심층 리서치). 기본 standard */
  mode?: 'quick' | 'standard' | 'deep'
  /** AI 우선 분석. 기본 gemini. 실패 시 다른 모델로 폴백 */
  primaryProvider?: AIPrimaryModel
  /** Step-level AI settings: per-step Gemini/Groq selection */
  stepAISettings?: import('@/lib/ai/step-ai-resolver').StepAISettings
  /** AbortSignal for timeout/client disconnect. When aborted, generator yields error and stops. */
  signal?: AbortSignal
  /** true면 DB 캐시 무시하고 항상 새 분석 실행 (다시 분석하기용) */
  forceReanalyze?: boolean
  /**
   * 부분 재실행: 2 = 인사이트부터(데이터 수집 스킵), 3 = 전략·실행부터(인사이트까지 스킵).
   * 저장된 analysis_tasks가 없으면 전체 파이프라인으로 폴백합니다.
   */
  rerunFromPhase?: 1 | 2 | 3
}

type RssItem = {
  title?: string
  link?: string
  pubDate?: string
  contentSnippet?: string
  content?: string
}
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

/** Article count for extraction by depth: quick=3, standard=5, deep=8. */
const ARTICLE_COUNT_BY_DEPTH: Record<'quick' | 'standard' | 'deep', number> = {
  quick: 3,
  standard: 5,
  deep: 8,
}

async function fetchNewsTitles(keyword: string, countryCode: string, maxItems: number = 15): Promise<NewsItem[]> {
  const { getNewsLocale } = await import('@/lib/news-rss-locale')
  const { gl, hl, ceid } = getNewsLocale(countryCode)
  const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`
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
    const items = (feed.items ?? []).slice(0, maxItems).map((it) => {
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

/** Parse AI JSON with validation and fallback. Never throws. */
function parseAiJson<T>(text: string, fallback: T, context?: string): T {
  const result = safeParseAiJson<T>(text, {
    fallback,
    repair: true,
    logFailures: true,
    context: context ?? 'runResearch',
  })
  return result.ok ? result.data : result.fallback
}

type TrendTaskResult = {
  trendData: { summary: string; market_score: number; positive_signals: string[]; neutral_signals: string[] }
  trendPayload: { trend_summary: string; market_temperature_score: number; growth_signals: string[] }
  usedFallback: boolean
  primaryProviderError?: string
}

type CompetitorEntry = {
  name: string
  positioning?: string
  target_market?: string
  key_feature?: string
  pricing?: string
  differentiation?: string
  strength?: string
  weakness?: string
}

type CompetitionTaskResult = {
  competitionData: {
    competitive_landscape: CompetitorEntry[]
    market_structure?: string
  }
  usedFallback: boolean
  primaryProviderError?: string
}

/** Run trend analysis (no yield; for parallel execution). Requires real data - no AI call when data empty. */
async function runTrendTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  articles: ArticleForAnalysis[],
  primaryProvider: AIPrimaryModel,
  webContext?: string
): Promise<TrendTaskResult> {
  const hasData = articles.length > 0 || (webContext?.trim().length ?? 0) > 0
  if (!hasData) {
    throw new Error('트렌드 분석에 필요한 데이터가 없습니다. 뉴스·웹 검색 결과를 확인해 주세요.')
  }
  const prompt = buildTaskTrendsPrompt(keyword, articles, webContext)
  if (!prompt.trim()) {
    throw new Error('트렌드 분석 프롬프트에 데이터가 포함되지 않았습니다.')
  }
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: TASK_TRENDS_SYSTEM, maxOutputTokens: 800, model: GEMINI_MODEL, isRetryable: () => false })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: TASK_TRENDS_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 800 })
  const primaryIsGemini = primaryProvider === 'gemini'
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      if (primaryIsGemini) {
        text = (await tryGemini()) ?? ''
      } else if (groqKey) {
        const groqRes = await tryGroq()
        if (!groqRes.text || groqRes.quotaError) throw new Error('Groq failed')
        text = groqRes.text
      } else throw new Error('Groq key not available')
      break
    } catch (err) {
      if (attempt < AI_MAX_RETRIES && is429OrQuotaError(err)) {
        await sleep(getExponentialDelayMs(attempt, AI_BASE_DELAY_MS))
      } else if (isFallbackTriggerError(err)) {
        primaryProviderError = getFallbackErrorReason(err)
        try {
          if (primaryIsGemini && groqKey) {
            const groqRes = await tryGroq()
            if (!groqRes.text || groqRes.quotaError) throw new Error('Groq fallback failed')
            text = groqRes.text
          } else if (!primaryIsGemini && geminiKey) {
            const gemRes = await tryGemini()
            text = (typeof gemRes === 'string' ? gemRes : '') ?? ''
          } else throw err
          usedFallback = true
          break
        } catch {
          throw err
        }
      } else {
        throw err
      }
    }
  }
  // Track usage when Gemini was used (primary or fallback)
  const usedGemini = primaryIsGemini ? !usedFallback : usedFallback
  if (usedGemini) await trackUsage('gemini')
  const fallbackTrend = {
    market_score: 50 as number,
    summary: '',
    positive_signals: [] as string[],
    neutral_signals: [] as string[],
  }
  const parseResult = safeParseAiJson<
    { market_score?: number; summary?: string; positive_signals?: string[]; neutral_signals?: string[] }
  >(typeof text === 'string' ? text : '', {
    fallback: fallbackTrend,
    logFailures: true,
    context: 'trend_analysis',
  })
  if (!parseResult.ok) {
    throw new Error('트렌드 분석 결과를 파싱하지 못했습니다. AI 응답 형식이 올바르지 않습니다.')
  }
  const parsed = parseResult.data
  const trendData = {
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
  return { trendData, trendPayload, usedFallback, primaryProviderError }
}

const ARTICLE_SUMMARY_SYSTEM = `You summarize news articles for market research. For each article, output a 2-3 sentence summary in Korean focusing on key facts, implications, and market relevance.
Return ONLY a JSON object: { "summaries": ["summary1", "summary2", ...] } in the same order as input. No other text.`

/** Summarize articles with AI (batch). Fallback: use title or content slice. */
async function summarizeArticlesWithAI(
  articles: ArticleWithContent[],
  geminiKey: string
): Promise<ArticleForAnalysis[]> {
  if (articles.length === 0) return []
  const prompt = `Summarize each article in 2-3 sentences (Korean). Focus on facts and market relevance.

${articles
  .map(
    (a, i) =>
      `[${i + 1}] title: ${a.title}\ncontent: ${a.content.slice(0, 1500)}${a.content.length > 1500 ? '...' : ''}`
  )
  .join('\n\n')}

Return ONLY: { "summaries": ["s1", "s2", ...] } same order.`

  try {
    const text = await generateText({
      apiKey: geminiKey,
      prompt,
      systemInstruction: ARTICLE_SUMMARY_SYSTEM,
      maxOutputTokens: 1500,
      model: GEMINI_MODEL,
      isRetryable: () => false,
    })
    const parsed = parseAiJson<{ summaries?: string[] }>(text ?? '', { summaries: [] }, 'article_summary')
    const summaries = Array.isArray(parsed.summaries) ? parsed.summaries : []
    return articles.map((a, i) => ({
      title: a.title,
      summary: typeof summaries[i] === 'string' && summaries[i].trim() ? summaries[i].trim() : a.content.slice(0, 300) || a.title,
      publisher: a.publisher,
    }))
  } catch {
    return articles.map((a) => ({
      title: a.title,
      summary: a.content.slice(0, 300) || a.title,
      publisher: a.publisher,
    }))
  }
}

/** Non-competitor patterns: magazines, blogs, news media – filter these out from competitive_landscape */
const NON_COMPETITOR_PATTERNS = /\b(magazine|mag|blog|뉴스|매거진|블로그|미디어|daily|times|post|journal|review|techcrunch|vogue|elle|forbes|medium\.com|substack|언론|매체)\b/i

function isLikelyNonCompetitor(entry: { name?: string; positioning?: string }): boolean {
  const name = (entry.name ?? '').trim()
  const positioning = (entry.positioning ?? '').trim()
  const combined = `${name} ${positioning}`.toLowerCase()
  return NON_COMPETITOR_PATTERNS.test(combined)
}

/** Run competition analysis from articles (no yield; for parallel execution with trend). */
async function runCompetitionTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  articles: ArticleForAnalysis[],
  primaryProvider: AIPrimaryModel,
  webContext?: string,
  competitorWebContext?: string
): Promise<CompetitionTaskResult> {
  const hasData =
    (competitorWebContext?.trim().length ?? 0) > 0 ||
    (webContext?.trim().length ?? 0) > 0 ||
    articles.length > 0
  if (!hasData) {
    return {
      competitionData: { competitive_landscape: [], market_structure: undefined },
      usedFallback: false,
    }
  }

  const prompt = buildTaskCompetitionPromptFromNews(keyword, articles, webContext, competitorWebContext)
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: TASK_COMPETITION_SYSTEM, maxOutputTokens: 1200, model: GEMINI_MODEL, isRetryable: () => false })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: TASK_COMPETITION_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 1200 })
  const primaryIsGemini = primaryProvider === 'gemini'
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      if (primaryIsGemini) {
        text = (await tryGemini()) ?? ''
      } else if (groqKey) {
        const groqRes = await tryGroq()
        if (!groqRes.text || groqRes.quotaError) throw new Error('Groq failed')
        text = groqRes.text
      } else throw new Error('Groq key not available')
      break
    } catch (err) {
      if (attempt < AI_MAX_RETRIES && is429OrQuotaError(err)) {
        await sleep(getExponentialDelayMs(attempt, AI_BASE_DELAY_MS))
      } else if (isFallbackTriggerError(err)) {
        primaryProviderError = getFallbackErrorReason(err)
        try {
          if (primaryIsGemini && groqKey) {
            const groqRes = await tryGroq()
            if (!groqRes.text || groqRes.quotaError) throw new Error('Groq fallback failed')
            text = groqRes.text
          } else if (!primaryIsGemini && geminiKey) {
            const gemRes = await tryGemini()
            text = (typeof gemRes === 'string' ? gemRes : '') ?? ''
          } else throw err
          usedFallback = true
          break
        } catch {
          throw err
        }
      } else {
        throw err
      }
    }
  }
  const usedGemini = primaryIsGemini ? !usedFallback : usedFallback
  if (usedGemini) await trackUsage('gemini')
  const fallbackCompetition: CompetitionTaskResult['competitionData'] = {
    competitive_landscape: [],
    market_structure: undefined,
  }
  type CompParsedSchema = {
    competitive_landscape?: Array<{
      name?: string
      positioning?: string
      target_market?: string
      key_feature?: string
      pricing?: string
      differentiation?: string
      strength?: string
      weakness?: string
    }>
    market_structure?: { summary?: string }
  }
  const compParseResult = safeParseAiJson<CompParsedSchema>(typeof text === 'string' ? text : '', {
    fallback: { competitive_landscape: [], market_structure: undefined } as CompParsedSchema,
    logFailures: true,
    context: 'competition_analysis',
  })
  if (!compParseResult.ok) {
    console.warn('[runCompetitionTask] 파싱 실패, fallback 사용', { keyword, preview: (typeof text === 'string' ? text : '').slice(0, 100) })
    return {
      competitionData: fallbackCompetition,
      usedFallback: true,
      primaryProviderError: '경쟁사 분석 결과 파싱 실패. 빈 결과로 진행합니다.',
    }
  }
  const parsed = compParseResult.data
  const landscape = Array.isArray(parsed?.competitive_landscape)
    ? parsed.competitive_landscape
        .filter((c): c is NonNullable<typeof parsed.competitive_landscape>[number] => typeof c?.name === 'string')
        .filter((c) => !isLikelyNonCompetitor(c))
        .slice(0, 10)
        .map((c) => ({
          name: String(c.name),
          positioning: typeof c.positioning === 'string' ? c.positioning : undefined,
          target_market: typeof c.target_market === 'string' ? c.target_market.trim() : undefined,
          key_feature: typeof c.key_feature === 'string' ? c.key_feature.trim() : undefined,
          pricing: typeof c.pricing === 'string' ? c.pricing.trim() : undefined,
          differentiation: typeof c.differentiation === 'string' ? c.differentiation.trim() : undefined,
          strength: typeof c.strength === 'string' ? c.strength.trim() : undefined,
          weakness: typeof c.weakness === 'string' ? c.weakness.trim() : undefined,
        }))
    : []
  const competitionData = {
    competitive_landscape: landscape,
    market_structure: typeof parsed?.market_structure?.summary === 'string' ? parsed.market_structure.summary : undefined,
  }
  return { competitionData, usedFallback, primaryProviderError }
}

export type CoreInsightItem = {
  title: string
  summary: string
  impact: string
  reason: string
  score?: number
}

type InsightExtractionResult = {
  key_insights: string[]
  opportunity_signals: string[]
  risk_signals: string[]
  core_insights: CoreInsightItem[]
}

function normalizeCoreInsight(raw: Record<string, unknown>): CoreInsightItem | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const summary = typeof raw.summary === 'string' ? raw.summary.trim() : ''
  const impact = typeof raw.impact === 'string' ? raw.impact.trim() : ''
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : ''
  if (!summary) return null
  return {
    title: title || summary.slice(0, 15).trim() + (summary.length > 15 ? '…' : ''),
    summary,
    impact: impact || '시장·제품 의사결정에 참고할 수 있는 요인입니다.',
    reason: reason || '분석 데이터를 바탕으로 도출된 인사이트입니다.',
    score: typeof raw.score === 'number' ? Math.min(10, Math.max(1, Math.round(raw.score))) : undefined,
  }
}

/** Post-process: title === summary → shorten title; dedupe by summary */
function postProcessCoreInsights(items: CoreInsightItem[]): CoreInsightItem[] {
  const seen = new Set<string>()
  return items
    .map((item) => {
      const { summary } = item
      let { title, impact, reason } = item
      if (title.trim() === summary.trim() && summary.length > 20) {
        title = summary.slice(0, 18).trim() + '…'
      }
      if (!impact.trim()) impact = '시장·제품 의사결정에 참고할 수 있는 요인입니다.'
      if (!reason.trim()) reason = '분석 데이터를 바탕으로 도출된 인사이트입니다.'
      const key = summary.slice(0, 80)
      if (seen.has(key)) return null
      seen.add(key)
      return { ...item, title, summary, impact, reason }
    })
    .filter((x): x is CoreInsightItem => x != null)
    .slice(0, 8)
}

/** Build fallback core_insights from trend + competition when AI fails or returns empty */
function buildFallbackCoreInsights(
  keyword: string,
  trendSignals: string[],
  marketScore: number,
  competitionSummary: string
): CoreInsightItem[] {
  const items: CoreInsightItem[] = []
  if (trendSignals.length > 0) {
    trendSignals.slice(0, 3).forEach((s) => {
      const t = s.trim()
      if (t.length < 3) return
      items.push({
        title: t.length > 15 ? t.slice(0, 14).trim() + '…' : t,
        summary: t,
        impact: '시장 동향 반영으로 제품·출시 타이밍 결정에 참고할 수 있습니다.',
        reason: '트렌드 분석 결과를 바탕으로 한 인사이트입니다.',
      })
    })
  }
  items.push({
    title: '시장 기회 점수',
    summary: `현재 시장 매력도는 ${marketScore}/100점으로 산출되었습니다.`,
    impact: '기회 점수는 진입·투자 우선순위 판단에 활용할 수 있습니다.',
    reason: '트렌드·경쟁·리스크 요인을 반영한 종합 지표입니다.',
    score: Math.min(10, Math.max(1, Math.round((marketScore / 100) * 10))),
  })
  if (competitionSummary && competitionSummary.length > 10) {
    items.push({
      title: '경쟁 환경',
      summary: competitionSummary.slice(0, 120) + (competitionSummary.length > 120 ? '…' : ''),
      impact: '경쟁 구도 파악은 차별화 포지셔닝에 필요합니다.',
      reason: '경쟁사 분석 결과를 요약한 내용입니다.',
    })
  }
  return items.slice(0, 6)
}

/** Step 3: Insight Extraction - structured JSON from market + competition */
async function runInsightExtractionTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  marketOverview: string,
  competitionSummary: string,
  primaryProvider: AIPrimaryModel,
  fallbackContext: { trendSignals: string[]; marketScore: number }
): Promise<{ data: InsightExtractionResult; usedFallback: boolean; primaryProviderError?: string }> {
  const prompt = buildInsightExtractionPrompt(keyword, marketOverview, competitionSummary)
  if (!prompt?.trim()) {
    throw new Error('인사이트 추출에 필요한 데이터가 없습니다. 트렌드·경쟁 분석 결과를 확인해 주세요.')
  }
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: INSIGHT_EXTRACTION_SYSTEM, maxOutputTokens: 1200, model: GEMINI_MODEL, isRetryable: () => false })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: INSIGHT_EXTRACTION_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 1200 })
  const primaryIsGemini = primaryProvider === 'gemini'
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      if (primaryIsGemini) {
        text = (await tryGemini()) ?? ''
      } else if (groqKey) {
        const groqRes = await tryGroq()
        if (!groqRes.text || groqRes.quotaError) throw new Error('Groq failed')
        text = groqRes.text
      } else throw new Error('Groq key not available')
      break
    } catch (err) {
      if (attempt < AI_MAX_RETRIES && is429OrQuotaError(err)) {
        await sleep(getExponentialDelayMs(attempt, AI_BASE_DELAY_MS))
      } else if (isFallbackTriggerError(err)) {
        primaryProviderError = getFallbackErrorReason(err)
        try {
          if (primaryIsGemini && groqKey) {
            const groqRes = await tryGroq()
            if (!groqRes.text || groqRes.quotaError) throw new Error('Groq fallback failed')
            text = groqRes.text
          } else if (!primaryIsGemini && geminiKey) {
            const gemRes = await tryGemini()
            text = (typeof gemRes === 'string' ? gemRes : '') ?? ''
          } else throw err
          usedFallback = true
          break
        } catch {
          throw err
        }
      } else {
        throw err
      }
    }
  }
  const usedGemini = primaryIsGemini ? !usedFallback : usedFallback
  if (usedGemini) await trackUsage('gemini')
  const fallbackInsight = { key_insights: [] as string[], opportunity_signals: [] as string[], risk_signals: [] as string[], core_insights: [] as CoreInsightItem[] }
  const parsed = parseAiJson<{
    key_insights?: string[]
    opportunity_signals?: string[]
    risk_signals?: string[]
    core_insights?: Array<Record<string, unknown>>
  }>(typeof text === 'string' ? text : '', fallbackInsight as Record<string, unknown>, 'insight_extraction')

  const key_insights = Array.isArray(parsed?.key_insights) ? parsed.key_insights.filter((s): s is string => typeof s === 'string') : []
  const opportunity_signals = Array.isArray(parsed?.opportunity_signals) ? parsed.opportunity_signals.filter((s): s is string => typeof s === 'string') : []
  const risk_signals = Array.isArray(parsed?.risk_signals) ? parsed.risk_signals.filter((s): s is string => typeof s === 'string') : []

  let core_insights: CoreInsightItem[] = []
  if (Array.isArray(parsed?.core_insights) && parsed.core_insights.length > 0) {
    const rawList = parsed.core_insights
      .map((r) => (r && typeof r === 'object' ? normalizeCoreInsight(r as Record<string, unknown>) : null))
      .filter((x): x is CoreInsightItem => x != null)
    core_insights = postProcessCoreInsights(rawList)
  }
  if (core_insights.length === 0) {
    core_insights = buildFallbackCoreInsights(
      keyword,
      fallbackContext.trendSignals,
      fallbackContext.marketScore,
      competitionSummary
    )
  }

  return {
    data: { key_insights, opportunity_signals, risk_signals, core_insights },
    usedFallback,
    primaryProviderError,
  }
}

type StrategicRecommendationResult = {
  opportunities: string[]
  risks: string[]
  strategy_summary: string
  market_summary?: string
  key_strategic_insights?: string[]
}

/** Step 4: Strategic Recommendation - structured JSON */
async function runStrategicRecommendationTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  marketOverview: string,
  competitionSummary: string,
  extractedInsights: InsightExtractionResult,
  primaryProvider: AIPrimaryModel
): Promise<{ data: StrategicRecommendationResult; usedFallback: boolean; primaryProviderError?: string }> {
  const prompt = buildStrategicRecommendationPrompt(keyword, marketOverview, competitionSummary, extractedInsights)
  if (!prompt?.trim()) {
    throw new Error('전략 제안에 필요한 데이터가 없습니다. 시장 개요·경쟁 분석 결과를 확인해 주세요.')
  }
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: STRATEGIC_RECOMMENDATION_SYSTEM, maxOutputTokens: 1000, model: GEMINI_MODEL, isRetryable: () => false })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: STRATEGIC_RECOMMENDATION_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 1000 })
  const primaryIsGemini = primaryProvider === 'gemini'
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      if (primaryIsGemini) {
        text = (await tryGemini()) ?? ''
      } else if (groqKey) {
        const groqRes = await tryGroq()
        if (!groqRes.text || groqRes.quotaError) throw new Error('Groq failed')
        text = groqRes.text
      } else throw new Error('Groq key not available')
      break
    } catch (err) {
      if (attempt < AI_MAX_RETRIES && is429OrQuotaError(err)) {
        await sleep(getExponentialDelayMs(attempt, AI_BASE_DELAY_MS))
      } else if (isFallbackTriggerError(err)) {
        primaryProviderError = getFallbackErrorReason(err)
        try {
          if (primaryIsGemini && groqKey) {
            const groqRes = await tryGroq()
            if (!groqRes.text || groqRes.quotaError) throw new Error('Groq fallback failed')
            text = groqRes.text
          } else if (!primaryIsGemini && geminiKey) {
            const gemRes = await tryGemini()
            text = (typeof gemRes === 'string' ? gemRes : '') ?? ''
          } else throw err
          usedFallback = true
          break
        } catch {
          throw err
        }
      } else {
        throw err
      }
    }
  }
  const usedGemini = primaryIsGemini ? !usedFallback : usedFallback
  if (usedGemini) await trackUsage('gemini')
  const fallbackStrategy: StrategicRecommendationResult = {
    opportunities: extractedInsights.opportunity_signals,
    risks: extractedInsights.risk_signals,
    strategy_summary: marketOverview,
  }
  const parsed = parseAiJson<StrategicRecommendationResult>(
    typeof text === 'string' ? text : '',
    fallbackStrategy,
    'strategy_generation'
  )
  return {
    data: {
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities.filter((s): s is string => typeof s === 'string') : extractedInsights.opportunity_signals,
      risks: Array.isArray(parsed.risks) ? parsed.risks.filter((s): s is string => typeof s === 'string') : extractedInsights.risk_signals,
      strategy_summary: typeof parsed.strategy_summary === 'string' ? parsed.strategy_summary : marketOverview,
      market_summary: typeof parsed.market_summary === 'string' ? parsed.market_summary.trim() : undefined,
      key_strategic_insights: Array.isArray(parsed.key_strategic_insights)
        ? parsed.key_strategic_insights.filter((s): s is string => typeof s === 'string').slice(0, 5)
        : undefined as string[] | undefined,
    },
    usedFallback,
    primaryProviderError,
  }
}

/** Step 5: PM Action Plan - structured JSON. Validates result; regenerates once if invalid. */
async function runPMActionPlanTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  strategySummary: string,
  opportunitiesSummary: string,
  risksSummary: string,
  primaryProvider: AIPrimaryModel
): Promise<{
  executionData: {
    product_actions: Array<{ action: string; priority?: string; reasoning?: string }>
    feature_ideas: string[]
    go_to_market_steps: string[]
    product_idea?: string
    target_customer?: string
    monetization?: string
    pm_action_plan?: PMActionPlanItem[]
    strategic_decision_layer?: {
      market_opportunity_explanation?: string
      competition_intensity?: 'low' | 'medium' | 'high'
      competition_explanation?: string
      product_market_fit?: 'low' | 'medium' | 'high'
      product_market_fit_explanation?: string
      entry_strategy?: string
      entry_explanation?: string
    }
    swot_analysis?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] }
    jtbd?: { main_jobs?: string[]; pains?: string[]; gains?: string[] }
    next_actions_pm?: Array<{ action: string; why?: string; how_to_execute?: string; priority?: 'high' | 'medium' | 'low'; estimated_effort?: string }>
  }
  usedFallback: boolean
  primaryProviderError?: string
}> {
  const prompt = buildPMActionPlanPrompt(keyword, strategySummary, opportunitiesSummary, risksSummary)
  if (!prompt?.trim()) {
    throw new Error('PM 액션 플랜에 필요한 데이터가 없습니다. 전략·기회·리스크 데이터를 확인해 주세요.')
  }
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: PM_ACTION_PLAN_SYSTEM, maxOutputTokens: 1600, model: GEMINI_MODEL, isRetryable: () => false })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: PM_ACTION_PLAN_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 1600 })
  const primaryIsGemini = primaryProvider === 'gemini'
  const getText = async (): Promise<string> => {
    for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
      try {
        if (primaryIsGemini) return (await tryGemini()) ?? ''
        if (groqKey) {
          const groqRes = await tryGroq()
          if (!groqRes.text || groqRes.quotaError) throw new Error('Groq failed')
          return groqRes.text
        }
        throw new Error('Groq key not available')
      } catch (err) {
        if (attempt < AI_MAX_RETRIES && is429OrQuotaError(err)) {
          await sleep(getExponentialDelayMs(attempt, AI_BASE_DELAY_MS))
        } else if (isFallbackTriggerError(err)) {
          try {
            if (primaryIsGemini && groqKey) {
              const groqRes = await tryGroq()
              if (!groqRes.text || groqRes.quotaError) throw new Error('Groq fallback failed')
              return groqRes.text
            }
            if (!primaryIsGemini && geminiKey) return (await tryGemini()) ?? ''
          } catch {
            throw err
          }
          throw err
        } else throw err
      }
    }
    return ''
  }
  let text = await getText()
  if (hasNonKoreanContent(text)) {
    try {
      const retry = await getText()
      if (!hasNonKoreanContent(retry)) text = retry
      else text = await ensureKoreanText(text, { regenerate: () => getText() })
    } catch {
      text = await ensureKoreanText(text)
    }
  }
  const usedFallback = false
  const primaryProviderError: string | undefined = undefined
  if (primaryIsGemini) await trackUsage('gemini')
  type ParsedShape = {
    product_actions?: Array<{ action?: string; priority?: string; reasoning?: string }>
    feature_ideas?: string[]
    go_to_market_steps?: string[]
    steps?: string[]
    priority?: string
    goal?: string
    risk?: string
    product_idea?: string
    target_customer?: string
    monetization?: string
    pm_action_plan?: Array<{ action_title?: string; description?: string; expected_outcome?: string; priority?: string; category?: string }>
    strategic_decision_layer?: {
      market_opportunity_explanation?: string
      competition_intensity?: string
      competition_explanation?: string
      product_market_fit?: string
      product_market_fit_explanation?: string
      entry_strategy?: string
      entry_explanation?: string
    }
    swot_analysis?: { strengths?: unknown[]; weaknesses?: unknown[]; opportunities?: unknown[]; threats?: unknown[] }
    jtbd?: { main_jobs?: unknown[]; pains?: unknown[]; gains?: unknown[] }
    next_actions_pm?: Array<{ action?: string; why?: string; how_to_execute?: string; priority?: string; estimated_effort?: string }>
  }
  const fallbackPm: ParsedShape = {
    product_actions: [],
    feature_ideas: [],
    go_to_market_steps: [],
    steps: [],
    priority: '',
    goal: '',
    risk: '',
  }
  let parsed = parseAiJson<ParsedShape>(typeof text === 'string' ? text : '', fallbackPm, 'execution_layer')
  const toStrArr = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : []
  const stepsArr = toStrArr(parsed?.steps)
  const hasValidPlan =
    (Array.isArray(parsed?.pm_action_plan) && parsed.pm_action_plan.length > 0) || stepsArr.length > 0
  if (!hasValidPlan && typeof text === 'string' && text.trim().length > 20) {
    try {
      const retryText = await getText()
      const retryParsed = parseAiJson<ParsedShape>(retryText, fallbackPm, 'execution_layer')
      const retrySteps = toStrArr(retryParsed?.steps)
      const retryPlan = Array.isArray(retryParsed?.pm_action_plan) ? retryParsed.pm_action_plan : []
      if (retryPlan.length > 0 || retrySteps.length > 0) parsed = retryParsed
    } catch {
      // keep first parse
    }
  }
  const actions = Array.isArray(parsed?.product_actions)
    ? parsed.product_actions
        .filter((a): a is { action: string; priority?: string; reasoning?: string } => typeof (a as { action?: string })?.action === 'string')
        .map((a) => ({ action: String((a as { action: string }).action), priority: (a as { priority?: string }).priority, reasoning: (a as { reasoning?: string }).reasoning }))
    : []
  let pmPlan: PMActionPlanItem[] = Array.isArray(parsed?.pm_action_plan)
    ? parsed.pm_action_plan
        .map((a) => {
          const raw = a as Record<string, unknown>
          const title = typeof raw?.action_title === 'string' ? raw.action_title.trim() : typeof raw?.action === 'string' ? raw.action.trim() : ''
          return title ? { ...raw, action_title: title } : null
        })
        .filter((a): a is NonNullable<typeof a> => a != null)
        .map((a): PMActionPlanItem => ({
          action_title: String((a as { action_title: string }).action_title),
          description: typeof (a as Record<string, unknown>).description === 'string' ? String((a as Record<string, unknown>).description) : undefined,
          expected_outcome: typeof (a as Record<string, unknown>).expected_outcome === 'string' ? String((a as Record<string, unknown>).expected_outcome) : undefined,
          priority: (['high', 'medium', 'low'] as const).includes((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            ? ((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            : undefined,
          category: (['mvp_experiment', 'user_interview', 'feature_prioritization', 'go_to_market'] as const).includes((a as Record<string, unknown>).category as 'mvp_experiment' | 'user_interview' | 'feature_prioritization' | 'go_to_market')
            ? ((a as Record<string, unknown>).category as 'mvp_experiment' | 'user_interview' | 'feature_prioritization' | 'go_to_market')
            : undefined,
        }))
    : []
  if (pmPlan.length === 0 && stepsArr.length > 0) {
    const priorityStr = typeof parsed?.priority === 'string' ? parsed.priority : 'medium'
    const priority = (['high', 'medium', 'low'] as const).includes(priorityStr as 'high' | 'medium' | 'low') ? (priorityStr as 'high' | 'medium' | 'low') : 'medium'
    pmPlan = stepsArr.map((step) => ({
      action_title: step,
      description: typeof parsed?.goal === 'string' ? parsed.goal : undefined,
      expected_outcome: typeof parsed?.risk === 'string' ? parsed.risk : undefined,
      priority,
      category: undefined,
    }))
  }
  const napm = Array.isArray(parsed?.next_actions_pm)
    ? parsed.next_actions_pm
        .filter((a): a is { action: string } => typeof (a as { action?: string })?.action === 'string')
        .slice(0, 5)
        .map((a) => ({
          action: String((a as { action: string }).action).trim(),
          why: typeof (a as Record<string, unknown>).why === 'string' ? String((a as Record<string, unknown>).why).trim() : undefined,
          how_to_execute: typeof (a as Record<string, unknown>).how_to_execute === 'string' ? String((a as Record<string, unknown>).how_to_execute).trim() : undefined,
          priority: (['high', 'medium', 'low'] as const).includes((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            ? ((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            : undefined,
          estimated_effort: typeof (a as Record<string, unknown>).estimated_effort === 'string' ? String((a as Record<string, unknown>).estimated_effort).trim() : undefined,
        }))
    : []
  const swot = parsed?.swot_analysis && typeof parsed.swot_analysis === 'object'
    ? {
        strengths: toStrArr(parsed.swot_analysis.strengths),
        weaknesses: toStrArr(parsed.swot_analysis.weaknesses),
        opportunities: toStrArr(parsed.swot_analysis.opportunities),
        threats: toStrArr(parsed.swot_analysis.threats),
      }
    : undefined
  const jtbdRaw = parsed?.jtbd && typeof parsed.jtbd === 'object'
    ? {
        main_jobs: toStrArr(parsed.jtbd.main_jobs),
        pains: toStrArr(parsed.jtbd.pains),
        gains: toStrArr(parsed.jtbd.gains),
      }
    : undefined
  return {
    executionData: {
      product_actions: actions,
      feature_ideas: toStrArr(parsed?.feature_ideas),
      go_to_market_steps: toStrArr(parsed?.go_to_market_steps),
      product_idea: typeof parsed?.product_idea === 'string' ? parsed.product_idea.trim() : undefined,
      target_customer: typeof parsed?.target_customer === 'string' ? parsed.target_customer.trim() : undefined,
      monetization: typeof parsed?.monetization === 'string' ? parsed.monetization.trim() : undefined,
      pm_action_plan: pmPlan.length > 0 ? pmPlan : undefined,
      strategic_decision_layer: parsed?.strategic_decision_layer && typeof parsed.strategic_decision_layer === 'object'
        ? (parsed.strategic_decision_layer as {
            market_opportunity_explanation?: string
            competition_intensity?: 'low' | 'medium' | 'high'
            competition_explanation?: string
            product_market_fit?: 'low' | 'medium' | 'high'
            product_market_fit_explanation?: string
            entry_strategy?: string
            entry_explanation?: string
          })
        : undefined,
      swot_analysis: swot,
      jtbd: jtbdRaw,
      next_actions_pm: napm.length > 0 ? napm : undefined,
    },
    usedFallback,
    primaryProviderError,
  }
}

/** Strategy Evaluation - score + label + reason per dimension */
type StrategyEvaluationResult = {
  market_attractiveness: number
  market_attractiveness_label?: string
  market_attractiveness_reason?: string
  competition_risk: number
  competition_risk_label?: string
  competition_risk_reason?: string
  execution_difficulty: number
  execution_difficulty_label?: string
  execution_difficulty_reason?: string
  growth_potential: number
  growth_potential_label?: string
  growth_potential_reason?: string
}

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseInt(String(n), 10) : 5
  return Math.min(10, Math.max(1, isNaN(v) ? 5 : Math.round(v)))
}

async function runStrategyEvaluationTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  strategyData: { strategy_summary: string; opportunities: string[]; risks: string[] },
  competitionSummary: string,
  executionData: { product_actions: Array<{ action: string }> },
  primaryProvider: AIPrimaryModel
): Promise<StrategyEvaluationResult> {
  const prompt = buildStrategyEvaluationPrompt(
    keyword,
    strategyData.strategy_summary,
    strategyData.opportunities.join('. '),
    strategyData.risks.join('. '),
    competitionSummary,
    executionData.product_actions.map((a) => a.action)
  )
  if (!prompt?.trim()) {
    throw new Error('전략 평가에 필요한 데이터가 없습니다.')
  }
  let text!: string
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: STRATEGY_EVALUATION_SYSTEM, maxOutputTokens: 450, model: GEMINI_MODEL, isRetryable: () => false })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: STRATEGY_EVALUATION_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 450 })
  const primaryIsGemini = primaryProvider === 'gemini'
  try {
    if (primaryIsGemini) {
      text = (await tryGemini()) ?? ''
    } else if (groqKey) {
      const groqRes = await tryGroq()
      text = groqRes?.text ?? ''
    } else {
      text = (await tryGemini()) ?? ''
    }
  } catch (err) {
    throw new Error('전략 평가 중 오류가 발생했습니다. ' + (err instanceof Error ? err.message : String(err)))
  }
  const fallbackEval: StrategyEvaluationResult = {
    market_attractiveness: 5,
    competition_risk: 5,
    execution_difficulty: 5,
    growth_potential: 5,
  }
  const evalParseResult = safeParseAiJson<StrategyEvaluationResult>(
    typeof text === 'string' ? text : '',
    { fallback: fallbackEval, logFailures: true, context: 'strategy_evaluation' }
  )
  if (!evalParseResult.ok) {
    throw new Error('전략 평가 결과를 파싱하지 못했습니다. AI 응답 형식이 올바르지 않습니다.')
  }
  const parsed = evalParseResult.data
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)
  return {
    market_attractiveness: clampScore(parsed.market_attractiveness),
    market_attractiveness_label: str(parsed.market_attractiveness_label),
    market_attractiveness_reason: str(parsed.market_attractiveness_reason),
    competition_risk: clampScore(parsed.competition_risk),
    competition_risk_label: str(parsed.competition_risk_label),
    competition_risk_reason: str(parsed.competition_risk_reason),
    execution_difficulty: clampScore(parsed.execution_difficulty),
    execution_difficulty_label: str(parsed.execution_difficulty_label),
    execution_difficulty_reason: str(parsed.execution_difficulty_reason),
    growth_potential: clampScore(parsed.growth_potential),
    growth_potential_label: str(parsed.growth_potential_label),
    growth_potential_reason: str(parsed.growth_potential_reason),
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
  const parsed = parseAiJson<unknown>(text, {}, 'pass1')
  const validation = validatePass1(parsed)
  return validation.success ? validation.data : null
}

function parsePass2Response(text: string): Pass2Result | null {
  const parsed = parseAiJson<unknown>(text, {}, 'pass2')
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
  const fallback = {} as StrategicAnalysisResult
  const parsed = parseAiJson<StrategicAnalysisResult>(text, fallback, 'strategic')
  if (typeof parsed !== 'object' || parsed == null) return null
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
    chartData: buildChartDataFromAnalysis(pos.length, neu.length, neg.length, score),
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

  return { pass1, summary: sanitizeDeep(summary), structured: sanitizeDeep(structured) }
}

const FALLBACK_PASS1: Pass1Result = {
  summary: '분석 중 일부 데이터를 처리하지 못했습니다. 다시 시도해 주세요.',
  temperature: 50,
  insights: ['데이터 수집 완료', '분석 진행 중'],
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
    chartData: buildChartDataFromAnalysis(pos.length, neu.length, neg.length, p1.temperature),
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

  return { summary: sanitizeDeep(summary), structured: sanitizeDeep(structured) }
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
  return `키워드: "${keyword}"${newsBlock}${baseSummary}PM 사고 순서로 작성하세요: 무슨 일이 일어나는지, 왜 중요한지, 시장 영향, 기회, 리스크, 전략 제안, 액션 제안. 컨설팅 보고서 수준·한국 PM 문서 톤. 단순 요약 금지. 향후 전망과 투자/행동 아이디어를 2~4문단 마크다운으로 작성하세요.`
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
const TIMEOUT_MESSAGE = '요청 시간이 초과되었습니다. 다시 시도해 주세요.'

function checkAborted(signal: AbortSignal | undefined): boolean {
  return !!signal?.aborted
}

export async function* runResearch(
  params: RunResearchParams
): AsyncGenerator<ResearchStreamEvent> {
  const {
    supabase,
    keyword,
    countryCode,
    userId,
    geminiKey,
    groqKey,
    serperKey,
    mode: depthMode = 'standard',
    primaryProvider: primaryProviderParam,
    stepAISettings: stepSettings,
    signal,
    forceReanalyze,
    rerunFromPhase,
  } = params
  const webSearchOptions = (serperKey ?? '').trim() ? { apiKey: (serperKey ?? '').trim() } : {}
  const serperUsed = !!(serperKey && serperKey.trim())
  const primaryProvider: AIPrimaryModel = primaryProviderParam ?? 'gemini'
  const { resolveAIForStep } = await import('@/lib/ai/step-ai-resolver')
  const effectiveStepSettings: { ai_primary_model: AIPrimaryModel } = stepSettings
    ? { ...stepSettings, ai_primary_model: (stepSettings.ai_primary_model === 'groq' ? 'groq' : 'gemini') }
    : { ai_primary_model: primaryProvider }
  const cacheKey = buildCacheKeyParts(userId, keyword, countryCode)

  const wantsPartialRerun = rerunFromPhase === 2 || rerunFromPhase === 3

  // Check cache first (skip when forceReanalyze = true: 사용자가 "다시 분석하기"를 누른 경우)
  let cacheRow: { report_id: string; updated_at: string } | null = null
  if (!forceReanalyze && !wantsPartialRerun) {
    const { data } = await supabase
      .from('research_history')
      .select('report_id, updated_at')
      .eq('user_id', cacheKey.userId)
      .eq('keyword', cacheKey.keyword)
      .eq('country_code', cacheKey.countryCode)
      .maybeSingle()
    cacheRow = data
  }

  const pipelineStartMs = Date.now()
  const analysisId = `${cacheKey.userId}|${cacheKey.keyword}|${cacheKey.countryCode}`

  let resumeState: PipelineResumeState | null = null
  if (wantsPartialRerun && !forceReanalyze) {
    resumeState = await loadPipelineResumeState(supabase, analysisId, rerunFromPhase === 3 ? 3 : 2)
  }
  const skipDataCollection = !!resumeState
  const skipInsightExtraction = resumeState?.kind === 'before_strategy'

  console.log('[AI Pipeline] Start', {
    keyword,
    primaryProvider,
    hasGemini: !!geminiKey,
    hasGroq: !!groqKey,
    forceReanalyze,
    partialResume: skipDataCollection,
    rerunFromPhase,
  })
  const log = (step: string, detail: string, extra?: Record<string, unknown>) => {
    console.log('[AI Timeline]', { step, detail, provider: primaryProvider, analysisId: analysisId.slice(0, 40) + '...', keyword, elapsedMs: Date.now() - pipelineStartMs, ...extra })
  }

  const upsertAnalysisTask = async (
    step: AnalysisTaskId,
    status: 'pending' | 'running' | 'completed' | 'failed',
    opts?: {
      outputData?: unknown
      errorMessage?: string
      provider?: AnalysisStepProvider | null
      fallback_used?: boolean
      primary_provider_error?: string | null
    }
  ) => {
    const now = new Date().toISOString()
    const row: Record<string, unknown> = {
      analysis_id: analysisId,
      step_name: step,
      status,
      started_at: status === 'running' || status === 'completed' || status === 'failed' ? now : null,
      completed_at: status === 'completed' || status === 'failed' ? now : null,
      output_data: opts?.outputData ?? null,
      error_message: opts?.errorMessage ?? null,
      provider: opts?.provider ?? null,
      fallback_used: opts?.fallback_used ?? false,
      updated_at: now,
    }
    if (opts?.primary_provider_error != null) {
      row.primary_provider_error = opts.primary_provider_error
    }
    await supabase.from('analysis_tasks').upsert(row, { onConflict: 'analysis_id,step_name' })
  }

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'init' }
    return
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

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'web_search' }
    return
  }

  // Web search grounding: user input → web search → top sources → feed to LLM
  let webContext = ''
  if (!skipDataCollection) {
    try {
      const webResults = await searchWeb(keyword, { num: 10, ...webSearchOptions })
      webContext = formatWebContext(webResults, 10)
      if (webResults.length > 0) {
        log('web_grounding', 'completed', { sourcesCount: webResults.length })
      }
    } catch (err) {
      console.warn('[AI Timeline] web search failed (continuing without)', { keyword, err })
    }
  }

  const depthForDb = depthMode === 'quick' ? 'fast' : depthMode
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
          analysis_depth: depthForDb,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,keyword,country_code' }
      )
  }

  await updateProgress(0, 'analyzing')
  log('start', 'analysis_started')
  console.log('[AI Analysis] 시작', { keyword: cacheKey.keyword, countryCode: cacheKey.countryCode, analysisId: analysisId.slice(0, 50) + '...' })
  yield { type: 'analysis_started', analysisId }

  let news: NewsItem[] = []
  let trendData: TrendDataShape = {
    summary: '',
    market_score: 50,
    positive_signals: [],
    neutral_signals: [],
  }
  let competitionData: CompetitionDataShape = { competitive_landscape: [] }
  let marketOverview = ''
  let competitionSummary = ''

  if (skipDataCollection && resumeState) {
    const phase = rerunFromPhase === 3 ? 3 : 2
    const skippedSteps =
      resumeState.kind === 'before_strategy'
        ? ['signal_layer', 'article_extraction', 'trend_analysis', 'competition_analysis', 'insight_extraction']
        : ['signal_layer', 'article_extraction', 'trend_analysis', 'competition_analysis']
    yield {
      type: 'pipeline_resume',
      phase,
      skippedSteps,
      message:
        resumeState.kind === 'before_strategy'
          ? '저장된 인사이트까지 반영된 상태에서 전략·실행 단계만 다시 수행합니다.'
          : '저장된 데이터 수집 결과를 사용하고 인사이트부터 다시 수행합니다.',
    }
    news = resumeState.news as NewsItem[]
    trendData = resumeState.trendData
    competitionData = resumeState.competitionData
    marketOverview = resumeState.marketOverview
    competitionSummary = resumeState.competitionSummary
    yield { type: 'news', items: news }
    yield {
      type: 'pass1',
      summary: trendData.summary,
      temperature: trendData.market_score,
      insights: trendData.positive_signals,
    }
    await updateProgress(skipInsightExtraction ? 3 : 2, 'analyzing')
  }

  // Layer 1: Signal Layer - collect news, extract article content, summarize
  if (!skipDataCollection) {
  const articleCount = ARTICLE_COUNT_BY_DEPTH[depthMode]
  log('signal_layer', 'running', { depthMode, articleCount })
  await upsertAnalysisTask('signal_layer', 'running', { provider: null, fallback_used: false })
  yield { type: 'task', task: 'signal_layer', status: 'running', provider: null, fallback_used: false }
  try {
    news = await fetchNewsTitles(keyword, cacheKey.countryCode, Math.max(articleCount, 15))
    const publishers = [...new Set(news.map((n) => n.publisher).filter(Boolean))] as string[]
    const signalSources = publishers.length > 0 ? publishers : ['Google News', 'RSS 피드']
    const signalData = {
      signals: signalSources,
      news_activity: news.map((n) => ({ title: n.title, url: n.url, publisher: n.publisher })),
    }
    await upsertAnalysisTask('signal_layer', 'completed', { outputData: signalData, provider: null, fallback_used: false })
    log('signal_layer', 'completed', { newsCount: news.length })
    yield {
      type: 'task',
      task: 'signal_layer',
      status: 'completed',
      data: signalData,
      provider: null,
      fallback_used: false,
    }
    yield { type: 'news', items: news }
  } catch (err) {
    const msg = toUserFriendlyError(err, '시장 신호 수집에 실패했습니다.')
    log('signal_layer', 'failed', { error: msg, err })
    await upsertAnalysisTask('signal_layer', 'failed', { errorMessage: msg, provider: null, fallback_used: false })
    await updateProgress(0, 'failed')
    yield { type: 'task', task: 'signal_layer', status: 'failed', error: msg, fallbackMessage: msg, provider: null, fallback_used: false }
    yield { type: 'error', message: msg, step: 'signal_layer' }
    return
  }

  const articlesToExtract = news.slice(0, articleCount)

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'signal_layer' }
    return
  }

  // Article content extraction (Readability) - yield before each to show progress
  const ARTICLE_REQUEST_DELAY_MS = 500
  const results: ArticleWithContent[] = []
  for (let i = 0; i < articlesToExtract.length; i++) {
    if (checkAborted(signal)) {
      yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'signal_layer' }
      return
    }
    if (i > 0) await new Promise((r) => setTimeout(r, ARTICLE_REQUEST_DELAY_MS))
    yield {
      type: 'task',
      task: 'article_extraction',
      status: 'running',
      provider: null,
      fallback_used: false,
      currentArticleTitle: articlesToExtract[i].title.slice(0, 60),
    }
    try {
      const extracted = await extractArticleContent(articlesToExtract[i])
      results.push(extracted)
    } catch {
      results.push({ ...articlesToExtract[i], content: articlesToExtract[i].title })
    }
  }
  const articlesWithContent = results
  console.log('[article-extract] done:', articlesWithContent.length, '| items:', articlesWithContent.map((a) => ({ title: a.title.slice(0, 40), contentLen: a.content.length })))

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'signal_layer' }
    return
  }

  // Article summarization (AI)
  let articlesForAnalysis: ArticleForAnalysis[]
  try {
    if (articlesWithContent.length > 0) {
      yield {
        type: 'task',
        task: 'article_summary',
        status: 'running',
        provider: 'gemini',
        fallback_used: false,
        currentArticleTitle: articlesWithContent[0].title.slice(0, 60),
      }
    }
    articlesForAnalysis = await summarizeArticlesWithAI(articlesWithContent, geminiKey)
    console.log('[article-summary] done:', articlesForAnalysis.length, '| items:', articlesForAnalysis.map((a) => ({ title: a.title.slice(0, 40), summaryLen: a.summary?.length ?? 0, summaryPreview: (a.summary ?? '').slice(0, 100) })))
  } catch (err) {
    console.warn('[article_summary] fallback to content', err)
    articlesForAnalysis = articlesWithContent.map((a) => ({
      title: a.title,
      summary: a.content.slice(0, 300) || a.title,
      publisher: a.publisher,
    }))
  }

  await updateProgress(1, 'analyzing')

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'signal_layer' }
    return
  }

  // Competitor-specific web search: "[keyword] competitors" / "[keyword] market" for real business data
  let competitorWebContext = ''
  try {
    const compQueries = [`${keyword} competitors`, `${keyword} market leaders`, `${keyword} platforms`]
    const compResults = await Promise.all(
      compQueries.slice(0, 2).map((q) => searchWeb(q, { num: 5, ...webSearchOptions }))
    )
    const merged = compResults.flat().slice(0, 12)
    if (merged.length > 0) {
      competitorWebContext = formatWebContext(merged, 12)
      log('competition_analysis', 'competitor_search_done', { resultsCount: merged.length })
    }
  } catch (err) {
    console.warn('[AI Timeline] competitor web search failed (continuing without)', { keyword, err })
  }

  // Layer 2: 시장 리서치 (trend) 완료 후 → Layer 3: 경쟁사 분석 (competition) 순차 실행
  const marketProvider = resolveAIForStep(effectiveStepSettings, 'market')
  const competitorProvider = resolveAIForStep(effectiveStepSettings, 'competitor')

  log('trend_analysis', 'running')
  await upsertAnalysisTask('trend_analysis', 'running', { provider: marketProvider, fallback_used: false })
  yield { type: 'task', task: 'trend_analysis', status: 'running', provider: marketProvider, fallback_used: false }

  const trendSettled = await Promise.allSettled([
    runTrendTask(geminiKey, groqKey, keyword, articlesForAnalysis, marketProvider, webContext),
  ]).then(([r]) => r as PromiseSettledResult<Awaited<ReturnType<typeof runTrendTask>>>)

  if (trendSettled.status === 'rejected') {
    const msg = toUserFriendlyError(trendSettled.reason, '트렌드 분석 중 오류가 발생했습니다.')
    log('trend_analysis', 'failed', { error: msg, err: trendSettled.reason })
    await upsertAnalysisTask('trend_analysis', 'failed', { errorMessage: msg, provider: marketProvider, fallback_used: false })
    await updateProgress(1, 'failed')
    yield { type: 'task', task: 'trend_analysis', status: 'failed', error: msg, fallbackMessage: msg, provider: marketProvider, fallback_used: false }
    yield { type: 'error', message: msg, step: 'trend_analysis' }
    return
  }

  log('competition_analysis', 'running')
  await upsertAnalysisTask('competition_analysis', 'running', { provider: competitorProvider, fallback_used: false })
  yield { type: 'task', task: 'competition_analysis', status: 'running', provider: competitorProvider, fallback_used: false }

  const compSettled = await Promise.allSettled([
    runCompetitionTask(geminiKey, groqKey, keyword, articlesForAnalysis, competitorProvider, webContext, competitorWebContext || undefined),
  ]).then(([r]) => r as PromiseSettledResult<Awaited<ReturnType<typeof runCompetitionTask>>>)

  if (compSettled.status === 'rejected') {
    const msg = toUserFriendlyError(compSettled.reason, '경쟁 환경 분석 중 오류가 발생했습니다.')
    log('competition_analysis', 'failed', { error: msg, err: compSettled.reason })
    await upsertAnalysisTask('competition_analysis', 'failed', { errorMessage: msg, provider: competitorProvider, fallback_used: false })
    await updateProgress(2, 'failed')
    yield { type: 'task', task: 'competition_analysis', status: 'failed', error: msg, fallbackMessage: msg, provider: competitorProvider, fallback_used: false }
    yield { type: 'error', message: msg, step: 'competition_analysis' }
    return
  }

  const trendResult = trendSettled.value
  const compResult = compSettled.value
  trendData = trendResult.trendData
  competitionData = compResult.competitionData

  const trendProvider = marketProvider === 'gemini' ? (trendResult.usedFallback ? 'groq' : 'gemini') : (trendResult.usedFallback ? 'gemini' : 'groq')
  const compProvider = competitorProvider === 'gemini' ? (compResult.usedFallback ? 'groq' : 'gemini') : (compResult.usedFallback ? 'gemini' : 'groq')
  await upsertAnalysisTask('trend_analysis', 'completed', {
    outputData: trendResult.trendPayload,
    provider: trendProvider,
    fallback_used: trendResult.usedFallback,
    primary_provider_error: trendResult.usedFallback ? trendResult.primaryProviderError ?? null : null,
  })
  await upsertAnalysisTask('competition_analysis', 'completed', {
    outputData: competitionData,
    provider: compProvider,
    fallback_used: compResult.usedFallback,
    primary_provider_error: compResult.usedFallback ? compResult.primaryProviderError ?? null : null,
  })
  log('trend_analysis', 'completed', { usedFallback: trendResult.usedFallback })
  log('competition_analysis', 'completed', { competitorsCount: competitionData.competitive_landscape.length, usedFallback: compResult.usedFallback })
  await updateProgress(3, 'analyzing')

  yield {
    type: 'task',
    task: 'trend_analysis',
    status: 'completed',
    data: trendResult.trendPayload,
    provider: trendProvider,
    fallback_used: trendResult.usedFallback,
    primaryProviderError: trendResult.usedFallback ? trendResult.primaryProviderError : undefined,
  }
  yield {
    type: 'task',
    task: 'competition_analysis',
    status: 'completed',
    data: competitionData,
    provider: compProvider,
    fallback_used: compResult.usedFallback,
    primaryProviderError: compResult.usedFallback ? compResult.primaryProviderError : undefined,
  }
  yield {
    type: 'pass1',
    summary: trendData.summary,
    temperature: trendData.market_score,
    insights: trendData.positive_signals,
  }

  competitionSummary = competitionData.competitive_landscape
    .map((c) => (c.positioning ? `${c.name}: ${c.positioning}` : c.name))
    .join('. ') || competitionData.market_structure || ''

  marketOverview = trendData.summary

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'trend_competition' }
    return
  }

  } // end if (!skipDataCollection)

  // Step 3: Insight Extraction
  const insightProviderResolved = resolveAIForStep(effectiveStepSettings, 'insight')
  let insightData: InsightExtractionResult

  if (skipInsightExtraction && resumeState?.kind === 'before_strategy') {
    insightData = resumeState.insightData as InsightExtractionResult
    log('insight_extraction', 'skipped_resume', {})
  } else {
  log('insight_extraction', 'running')
  await upsertAnalysisTask('insight_extraction', 'running', { provider: insightProviderResolved, fallback_used: false })
  yield { type: 'task', task: 'insight_extraction', status: 'running', provider: insightProviderResolved, fallback_used: false }
  try {
    const insightResult = await runInsightExtractionTask(
      geminiKey,
      groqKey,
      keyword,
      marketOverview,
      competitionSummary,
      insightProviderResolved,
      {
        trendSignals: trendData.positive_signals,
        marketScore: trendData.market_score,
      }
    )
    insightData = insightResult.data
    const insightProvider = primaryProvider === 'gemini' ? (insightResult.usedFallback ? 'groq' : 'gemini') : (insightResult.usedFallback ? 'gemini' : 'groq')
    await upsertAnalysisTask('insight_extraction', 'completed', {
      outputData: insightData,
      provider: insightProvider,
      fallback_used: insightResult.usedFallback,
      primary_provider_error: insightResult.usedFallback ? insightResult.primaryProviderError ?? null : null,
    })
    log('insight_extraction', 'completed')
    yield { type: 'task', task: 'insight_extraction', status: 'completed', data: insightData, provider: insightProvider, fallback_used: insightResult.usedFallback }
  } catch (err) {
    const msg = toUserFriendlyError(err, '인사이트 추출 중 오류가 발생했습니다.')
    log('insight_extraction', 'failed', { error: msg, err })
    await upsertAnalysisTask('insight_extraction', 'failed', { errorMessage: msg, provider: insightProviderResolved, fallback_used: false })
    yield { type: 'task', task: 'insight_extraction', status: 'failed', error: msg, fallbackMessage: msg, provider: insightProviderResolved, fallback_used: false }
    yield { type: 'error', message: msg, step: 'insight_extraction' }
    insightData = {
      key_insights: trendData.positive_signals,
      opportunity_signals: trendData.positive_signals,
      risk_signals: [],
      core_insights: buildFallbackCoreInsights(
        keyword,
        trendData.positive_signals,
        trendData.market_score,
        competitionSummary
      ),
    }
  }
  } // end else (insight extraction path)

  const stratPrimaryIsGemini = primaryProvider === 'gemini'

  // Rate-limit guard: brief pause before next AI call to avoid 429
  await sleep(500)

  // Step 4: Strategic Recommendation
  const step4StartMs = Date.now()
  log('strategic_recommendation', 'running', {
    elapsedSinceStart: Date.now() - pipelineStartMs,
    hasGeminiKey: !!geminiKey,
    hasGroqKey: !!groqKey,
    primaryProvider,
  })
  const strategyProvider = resolveAIForStep(effectiveStepSettings, 'strategy')
  const hasStrategyProviderKey = strategyProvider === 'groq' ? !!groqKey : !!geminiKey
  const effectiveStrategyProvider = hasStrategyProviderKey ? strategyProvider : (groqKey ? 'groq' : 'gemini')
  await upsertAnalysisTask('strategy_generation', 'running', { provider: effectiveStrategyProvider, fallback_used: false })
  yield { type: 'task', task: 'strategy_generation', status: 'running', provider: effectiveStrategyProvider, fallback_used: false }
  let strategyData: StrategicRecommendationResult
  try {
    const stratResult = await runStrategicRecommendationTask(
      geminiKey,
      groqKey,
      keyword,
      marketOverview,
      competitionSummary,
      insightData,
      effectiveStrategyProvider
    )
    strategyData = stratResult.data
    const stratProvider = effectiveStrategyProvider === 'gemini' ? (stratResult.usedFallback ? 'groq' : 'gemini') : (stratResult.usedFallback ? 'gemini' : 'groq')
    await upsertAnalysisTask('strategy_generation', 'completed', {
      outputData: strategyData,
      provider: stratProvider,
      fallback_used: stratResult.usedFallback,
      primary_provider_error: stratResult.usedFallback ? stratResult.primaryProviderError ?? null : null,
    })
    log('strategic_recommendation', 'completed', { durationMs: Date.now() - step4StartMs, usedFallback: stratResult.usedFallback })
    yield { type: 'task', task: 'strategy_generation', status: 'completed', data: strategyData, provider: stratProvider, fallback_used: stratResult.usedFallback }
  } catch (err) {
    const msg = toUserFriendlyError(err, '전략 추천 생성 중 오류가 발생했습니다.')
    const cause = err instanceof Error ? err.message : String(err)
    const stackSnippet = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 4).join(' ') : undefined
    console.error('[AI Pipeline] strategy_generation failed (continuing with fallback)', {
      step: 'strategy_generation',
      error: msg,
      cause,
      stack: stackSnippet,
    })
    log('strategy_generation', 'failed', {
      error: msg,
      durationMs: Date.now() - step4StartMs,
      elapsedSinceStart: Date.now() - pipelineStartMs,
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    })
    const errorForUi = cause && cause !== msg ? `전략 추천: ${cause}` : msg
    await upsertAnalysisTask('strategy_generation', 'failed', { errorMessage: errorForUi, provider: effectiveStrategyProvider, fallback_used: false })
    strategyData = {
      opportunities: insightData.opportunity_signals,
      risks: insightData.risk_signals,
      strategy_summary: marketOverview,
      market_summary: undefined,
      key_strategic_insights: undefined,
    }
    yield { type: 'task', task: 'strategy_generation', status: 'failed', error: errorForUi, fallbackMessage: errorForUi, provider: effectiveStrategyProvider, fallback_used: false }
  }

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'strategy_generation' }
    return
  }

  // Rate-limit guard: brief pause before next AI call
  await sleep(500)

  // Step 5: PM Action Plan
  const opportunitiesSummary = strategyData.opportunities.join('. ')
  const risksSummary = strategyData.risks.join('. ')
  let executionData: {
    product_actions: Array<{ action: string; priority?: string; reasoning?: string }>
    feature_ideas: string[]
    go_to_market_steps: string[]
    product_idea?: string
    target_customer?: string
    monetization?: string
    pm_action_plan?: PMActionPlanItem[]
    strategic_decision_layer?: {
      market_opportunity_explanation?: string
      competition_intensity?: 'low' | 'medium' | 'high'
      competition_explanation?: string
      product_market_fit?: 'low' | 'medium' | 'high'
      product_market_fit_explanation?: string
      entry_strategy?: string
      entry_explanation?: string
    }
    chart_insights?: { search_trend?: { insight?: string; takeaway?: string }; market_size?: { insight?: string; takeaway?: string }; adoption_rate?: { insight?: string; takeaway?: string }; score_distribution?: { insight?: string; takeaway?: string } }
    swot_analysis?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] }
    jtbd?: { main_jobs?: string[]; pains?: string[]; gains?: string[] }
    porter_5_forces?: { rivalry?: string[]; supplier_power?: string[]; buyer_power?: string[]; substitutes?: string[]; new_entrants?: string[] }
    next_actions_pm?: Array<{ action: string; why?: string; how_to_execute?: string; priority?: 'high' | 'medium' | 'low'; estimated_effort?: string }>
  }
  const actionProviderResolved = resolveAIForStep(effectiveStepSettings, 'action')
  await upsertAnalysisTask('execution_layer', 'running', { provider: actionProviderResolved, fallback_used: false })
  yield { type: 'task', task: 'execution_layer', status: 'running', provider: actionProviderResolved, fallback_used: false }
  try {
    const pmResult = await runPMActionPlanTask(
      geminiKey,
      groqKey,
      keyword,
      strategyData.strategy_summary,
      opportunitiesSummary,
      risksSummary,
      actionProviderResolved
    )
    executionData = {
      ...pmResult.executionData,
      chart_insights: undefined as {
        search_trend?: { insight?: string; takeaway?: string }
        market_size?: { insight?: string; takeaway?: string }
        adoption_rate?: { insight?: string; takeaway?: string }
        score_distribution?: { insight?: string; takeaway?: string }
      } | undefined,
      porter_5_forces: undefined as {
        rivalry?: string[]
        supplier_power?: string[]
        buyer_power?: string[]
        substitutes?: string[]
        new_entrants?: string[]
      } | undefined,
    }

    const executionProvider = actionProviderResolved === 'gemini' ? (pmResult.usedFallback ? 'groq' : 'gemini') : (pmResult.usedFallback ? 'gemini' : 'groq')
    await upsertAnalysisTask('execution_layer', 'completed', {
      outputData: executionData,
      provider: executionProvider,
      fallback_used: pmResult.usedFallback,
      primary_provider_error: pmResult.usedFallback ? pmResult.primaryProviderError ?? null : null,
    })
    log('pm_action_plan', 'completed', { usedFallback: pmResult.usedFallback })
    await updateProgress(5, 'analyzing')

    yield {
      type: 'task',
      task: 'execution_layer',
      status: 'completed',
      data: executionData,
      provider: executionProvider,
      fallback_used: pmResult.usedFallback,
      primaryProviderError: pmResult.usedFallback ? pmResult.primaryProviderError : undefined,
    }
  } catch (err) {
    const msg = toUserFriendlyError(err, 'PM 액션 플랜 생성 중 오류가 발생했습니다.')
    const cause = err instanceof Error ? err.message : String(err)
    const stackSnippet = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 4).join(' ') : undefined
    console.error('[AI Pipeline] execution_layer (PM action plan) failed (continuing with fallback)', {
      step: 'execution_layer',
      error: msg,
      cause,
      stack: stackSnippet,
    })
    log('pm_action_plan', 'failed', { error: msg, err })
    const errorForUi = cause && cause !== msg ? `PM 액션 플랜: ${cause}` : msg
    await upsertAnalysisTask('execution_layer', 'failed', { errorMessage: errorForUi, provider: actionProviderResolved, fallback_used: false })
    executionData = {
      product_actions: [],
      feature_ideas: [],
      go_to_market_steps: [],
      pm_action_plan: [],
      next_actions_pm: [],
    }
    yield { type: 'task', task: 'execution_layer', status: 'failed', error: errorForUi, fallbackMessage: errorForUi, provider: actionProviderResolved, fallback_used: false }
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

  const opportunityScoreData = computeOpportunityScore({
    market_score: trendData.market_score,
    positive_signals_count: pos.length,
    neutral_signals_count: neu.length,
    competitor_count: competitionData.competitive_landscape.length,
    opportunities_count: strategyData.opportunities.length,
    risks_count: strategyData.risks.length,
    product_actions_count: executionData.product_actions.length,
  })

  const fullSummary: InitialResearchSummary = {
    marketNews: pos.slice(0, 5),
    painPoints: neg.slice(0, 5),
    competitorTrends: competitionSummary,
    sentiment: trendData.market_score,
    publicReactionTrends: [...pos, ...neu, ...neg].join('. ').slice(0, 500),
    chartData: buildChartDataFromAnalysis(
      pos.length,
      neu.length,
      neg.length,
      trendData.market_score,
      opportunityScoreData.breakdown
    ),
    articleSummaries: [],
    keyConclusions: keyConclusions.slice(0, 5),
  }

  // Rate-limit guard before final evaluation call
  await sleep(500)

  let strategyEvaluation: StrategyEvaluationResult | undefined
  const riskProvider = resolveAIForStep(effectiveStepSettings, 'risk')
  const hasRiskProviderKey = riskProvider === 'groq' ? !!groqKey : !!geminiKey
  const effectiveRiskProvider = hasRiskProviderKey ? riskProvider : (groqKey ? 'groq' : 'gemini')
  yield { type: 'task', task: 'risk_opportunity', status: 'running' }
  try {
    strategyEvaluation = await runStrategyEvaluationTask(
      geminiKey,
      groqKey,
      keyword,
      strategyData,
      competitionSummary,
      executionData,
      effectiveRiskProvider
    )
    await upsertAnalysisTask('risk_opportunity', 'completed', { outputData: strategyEvaluation })
    yield { type: 'task', task: 'risk_opportunity', status: 'completed', data: strategyEvaluation }
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err)
    const stackSnippet = err instanceof Error && err.stack ? err.stack.split('\n').slice(0, 4).join(' ') : undefined
    console.error('[AI Pipeline] risk_opportunity (strategy evaluation) failed (continuing without)', {
      step: 'risk_opportunity',
      cause,
      stack: stackSnippet,
    })
    strategyEvaluation = undefined
    const errorForUi = cause && cause.length > 0 ? `리스크 및 기회 평가: ${cause}` : '리스크 및 기회 평가 중 오류가 발생했습니다.'
    await upsertAnalysisTask('risk_opportunity', 'failed', { errorMessage: errorForUi })
    yield { type: 'task', task: 'risk_opportunity', status: 'failed', error: errorForUi, fallbackMessage: errorForUi }
  }

  const structured: StructuredAnalysisFields = {
    market_temperature_score: trendData.market_score,
    summary_insights: strategyData.strategy_summary,
    market_summary: strategyData.market_summary,
    key_strategic_insights: strategyData.key_strategic_insights,
    core_insights: insightData.core_insights?.length ? insightData.core_insights : undefined,
    opportunity_areas: strategyData.opportunities.length > 0 ? strategyData.opportunities : undefined,
    recommended_product_strategy:
      executionData.product_idea || executionData.target_customer || executionData.monetization || strategyData.strategy_summary
        ? {
            summary: strategyData.strategy_summary,
            product_idea: executionData.product_idea,
            target_customer: executionData.target_customer,
            monetization: executionData.monetization,
          }
        : undefined,
    pm_action_plan: executionData.pm_action_plan,
    strategic_decision_layer: executionData.strategic_decision_layer,
    chart_insights: executionData.chart_insights,
    swot_analysis: executionData.swot_analysis,
    jtbd: executionData.jtbd,
    porter_5_forces: executionData.porter_5_forces,
    next_actions_pm: executionData.next_actions_pm,
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
      target_market: c.target_market,
      key_feature: c.key_feature,
      pricing: c.pricing,
      differentiation: c.differentiation,
      strength: c.strength,
      weakness: c.weakness,
    })),
    market_structure: competitionData.market_structure
      ? { competition_density: undefined, summary: competitionData.market_structure }
      : undefined,
    strategy_evaluation: strategyEvaluation
      ? {
          market_attractiveness: strategyEvaluation.market_attractiveness,
          market_attractiveness_label: strategyEvaluation.market_attractiveness_label,
          market_attractiveness_reason: strategyEvaluation.market_attractiveness_reason,
          competition_risk: strategyEvaluation.competition_risk,
          competition_risk_label: strategyEvaluation.competition_risk_label,
          competition_risk_reason: strategyEvaluation.competition_risk_reason,
          execution_difficulty: strategyEvaluation.execution_difficulty,
          execution_difficulty_label: strategyEvaluation.execution_difficulty_label,
          execution_difficulty_reason: strategyEvaluation.execution_difficulty_reason,
          growth_potential: strategyEvaluation.growth_potential,
          growth_potential_label: strategyEvaluation.growth_potential_label,
          growth_potential_reason: strategyEvaluation.growth_potential_reason,
        }
      : undefined,
  }

  // Sanitize all text fields before post-processing and yielding
  sanitizeDeep(structured)
  sanitizeDeep(fullSummary)

  // Post-processing: 기회 점수·차트 산출 (파이프라인 5단계 완료 후, done 전)
  yield { type: 'post_processing', stepId: 'key_metrics' }
  yield { type: 'pass2', structured }

  structured.opportunity_score = opportunityScoreData.opportunity_score
  structured.opportunity_score_breakdown = opportunityScoreData.breakdown
  structured.opportunity_score_reasoning = opportunityScoreData.score_reasoning

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'execution_layer' }
    return
  }

  // Step 4: Creative analysis — respects user's primaryProvider
  yield { type: 'post_processing', stepId: 'creative' }
  let creativeGroq: string | null = null
  let creativeGemini: string | null = null
  try {
    const creativeModel = resolveAIForStep(effectiveStepSettings, 'creative')
    const creativeProvider: 'groq' | 'gemini' | 'none' =
      creativeModel === 'groq' && groqKey ? 'groq' : geminiKey ? 'gemini' : groqKey ? 'groq' : 'none'
    log('creative_analysis', 'running', { provider: creativeProvider })
    if (creativeProvider !== 'none') {
      const summaryText = buildSummaryText(fullSummary)
      const newsHeadlines = news.map((n) => n.title).join('\n')
      const userPrompt = buildCreativePrompt(keyword, summaryText, newsHeadlines)

      const creative = await runTabAnalysis({
        groqKey: groqKey ?? null,
        geminiKey: geminiKey,
        provider: creativeProvider,
        systemPrompt: TAB_SYSTEM_PROMPT,
        userPrompt,
      })

      creativeGroq = creative.groqText ?? null
      creativeGemini = creative.geminiText ?? null
      if (creativeGroq && hasNonKoreanContent(creativeGroq)) creativeGroq = await ensureKoreanText(creativeGroq)
      if (creativeGemini && hasNonKoreanContent(creativeGemini)) creativeGemini = await ensureKoreanText(creativeGemini)
      await updateProgress(5, 'analyzing')
      yield { type: 'creative', groqText: creativeGroq, geminiText: creativeGemini }
    }
  } catch (err) {
    yield { type: 'creative', groqText: null, geminiText: null }
  }

  // Step 5: Persist to DB (only after all analysis succeeds)
  yield { type: 'post_processing', stepId: 'saving' }
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
        analysis_depth: depthForDb,
        serper_used: serperUsed,
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

      // Save to analysis_history for "My Analyses" page (every analysis, no overwrite)
      try {
        const productName = structured.recommended_product_strategy?.product_idea
          ?? executionData.product_idea
          ?? null
        const strategyText = strategyData.strategy_summary
          ?? structured.recommended_product_strategy?.summary
          ?? null
        const actionPlanJson = (structured.pm_action_plan?.length
          ? structured.pm_action_plan.map((a) => ({
              title: a.action_title,
              description: a.description,
              priority: a.priority,
            }))
          : (structured.pm_actions?.recommended_actions ?? []).slice(0, 8).map((a) =>
              typeof a === 'string' ? { title: a } : { title: (a as { title?: string })?.title, reasoning: (a as { reasoning?: string })?.reasoning }
            )
          ) as Array<{ title?: string; description?: string; priority?: string }>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('analysis_history').insert({
            user_id: cacheKey.userId,
            report_id: reportId,
            market_keyword: keyword,
            product_name: typeof productName === 'string' ? productName.trim() || null : null,
            generated_insights: {
              summary: structured.summary_insights ?? null,
              insights: structured.key_strategic_insights ?? null,
            },
            strategy_recommendation: typeof strategyText === 'string' ? strategyText.trim() || null : null,
            action_plan: actionPlanJson.length > 0 ? actionPlanJson : null,
            country_code: cacheKey.countryCode ?? 'KR',
          })
      } catch (ahErr) {
        console.warn('[AI Analysis] analysis_history insert skipped:', ahErr)
      }
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

  console.log('[AI Analysis] 완료', { keyword: cacheKey.keyword, reportId, hasKeyMetrics: !!structured, serperUsed })
  yield { type: 'done', reportId, sourceLinks: news, analysis_depth: depthForDb, serper_used: serperUsed }
}
