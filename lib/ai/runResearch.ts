/**
 * Single entry point for research execution.
 * AsyncGenerator that yields streaming events for incremental UI updates.
 * DB write only occurs after full analysis success.
 */
import Parser from 'rss-parser'
import { createAdminClient } from '@/lib/supabase/admin'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { generateText, runTabAnalysis, completeChat } from './unified-ai-service'
import {
  TASK_TRENDS_SYSTEM,
  buildTaskTrendsPrompt,
  TASK_COMPETITION_SYSTEM,
  buildTaskCompetitionPromptFromNews,
} from './pm-strategic-prompt'
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
import { sanitizeDeep, sanitizeStringArray, sanitizeForKoreanDisplay } from '@/lib/text-sanitize'

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
const TAB_SYSTEM_PROMPT =
  'CRITICAL: Output ONLY in Korean (한국어). Do NOT use Chinese (中文). 시장 분석 및 인사이트를 마크다운 형식으로 요약. 반드시 한국어로 작성. 중요 키워드는 **강조**. Facts/Hypotheses/Inferences 구분 가능 시 해당 레이블 사용. 질문·대화형 표현 금지.'

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

export type TaskCompletedPayload = {
  signal_layer?: { signals: string[]; news_activity?: Array<{ title: string; url?: string; publisher?: string }> }
  trend_analysis?: { trend_summary: string; market_temperature_score: number; growth_signals?: string[] }
  competition_analysis?: { competitive_landscape: Array<{ name: string; positioning?: string }>; market_structure?: string }
  insight_extraction?: { key_insights: string[]; opportunity_signals: string[]; risk_signals: string[] }
  strategy_generation?: { opportunities: string[]; risks: string[]; strategy_summary: string; market_summary?: string; key_strategic_insights?: string[] }
  execution_layer?: { product_actions: Array<{ action: string; priority?: string; reasoning?: string }>; feature_ideas?: string[]; go_to_market_steps?: string[] }
}

const ANALYSIS_TASK_STEPS: AnalysisTaskId[] = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
]

export type AnalysisStepProvider = 'gemini' | 'groq'

export type PostProcessingStepId = 'key_metrics' | 'creative' | 'saving'

export type ResearchStreamEvent =
  | { type: 'analysis_started'; analysisId: string }
  | { type: 'task'; task: AnalysisTaskId; status: 'running' | 'completed' | 'failed'; data?: TaskCompletedPayload[AnalysisTaskId]; error?: string; retryMessage?: string; retryAttempt?: number; provider?: AnalysisStepProvider | null; fallback_used?: boolean; primaryProviderError?: string }
  | { type: 'news'; items: NewsItem[] }
  | { type: 'pass1'; summary: string; temperature: number; insights: string[] }
  | { type: 'pass2'; structured: StructuredAnalysisFields }
  | { type: 'post_processing'; stepId: PostProcessingStepId }
  | { type: 'creative'; groqText: string | null; geminiText: string | null }
  | { type: 'done'; reportId: string; sourceLinks: NewsItem[] }
  | { type: 'cached'; reportId: string }
  | { type: 'error'; message: string; step?: string }

export type AIPrimaryModel = 'gemini' | 'groq'

export type RunResearchParams = {
  keyword: string
  countryCode: string
  userId: string
  geminiKey: string
  groqKey?: string | null
  /** 분석 깊이: quick(빠른 인사이트), standard(전체 리포트), deep(심층 리서치). 기본 standard */
  mode?: 'quick' | 'standard' | 'deep'
  /** AI 우선 분석. 기본 gemini. 실패 시 다른 모델로 폴백 */
  primaryProvider?: AIPrimaryModel
  /** AbortSignal for timeout/client disconnect. When aborted, generator yields error and stops. */
  signal?: AbortSignal
}

type RssItem = {
  title?: string
  link?: string
  pubDate?: string
  contentSnippet?: string
  content?: string
}
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

async function fetchNewsTitles(keyword: string, countryCode: string): Promise<NewsItem[]> {
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

/** Run trend analysis (no yield; for parallel execution). */
async function runTrendTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  newsTitles: string[],
  primaryProvider: AIPrimaryModel,
  webContext?: string
): Promise<TrendTaskResult> {
  const prompt = buildTaskTrendsPrompt(keyword, newsTitles, webContext)
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: TASK_TRENDS_SYSTEM, maxOutputTokens: 800, model: GEMINI_MODEL })
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
    summary: '데이터를 불러오지 못했습니다.',
    positive_signals: [] as string[],
    neutral_signals: [] as string[],
  }
  const parsed = parseAiJson<
    { market_score?: number; summary?: string; positive_signals?: string[]; neutral_signals?: string[] }
  >(typeof text === 'string' ? text : '', fallbackTrend, 'trend_analysis')
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

/** Run competition analysis from news (no yield; for parallel execution with trend). */
async function runCompetitionTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  newsTitles: string[],
  primaryProvider: AIPrimaryModel,
  webContext?: string
): Promise<CompetitionTaskResult> {
  const prompt = buildTaskCompetitionPromptFromNews(keyword, newsTitles, webContext)
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: TASK_COMPETITION_SYSTEM, maxOutputTokens: 1200, model: GEMINI_MODEL })
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
  const fallbackCompetition = {
    competitive_landscape: [] as Array<{ name?: string; positioning?: string }>,
    market_structure: undefined as { summary?: string } | undefined,
  }
  const parsed = parseAiJson<{
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
  }>(typeof text === 'string' ? text : '', fallbackCompetition, 'competition_analysis')
  const landscape = Array.isArray(parsed?.competitive_landscape)
    ? parsed.competitive_landscape
        .filter((c): c is NonNullable<typeof parsed.competitive_landscape>[number] => typeof c?.name === 'string')
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

type InsightExtractionResult = {
  key_insights: string[]
  opportunity_signals: string[]
  risk_signals: string[]
}

/** Step 3: Insight Extraction - structured JSON from market + competition */
async function runInsightExtractionTask(
  geminiKey: string,
  groqKey: string | null | undefined,
  keyword: string,
  marketOverview: string,
  competitionSummary: string,
  primaryProvider: AIPrimaryModel
): Promise<{ data: InsightExtractionResult; usedFallback: boolean; primaryProviderError?: string }> {
  const prompt = buildInsightExtractionPrompt(keyword, marketOverview, competitionSummary)
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: INSIGHT_EXTRACTION_SYSTEM, maxOutputTokens: 800, model: GEMINI_MODEL })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: INSIGHT_EXTRACTION_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 800 })
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
  const fallbackInsight = { key_insights: [] as string[], opportunity_signals: [] as string[], risk_signals: [] as string[] }
  const parsed = parseAiJson<{ key_insights?: string[]; opportunity_signals?: string[]; risk_signals?: string[] }>(
    typeof text === 'string' ? text : '',
    fallbackInsight,
    'insight_extraction'
  )
  const key_insights = Array.isArray(parsed?.key_insights) ? parsed.key_insights.filter((s): s is string => typeof s === 'string') : []
  const opportunity_signals = Array.isArray(parsed?.opportunity_signals) ? parsed.opportunity_signals.filter((s): s is string => typeof s === 'string') : []
  const risk_signals = Array.isArray(parsed?.risk_signals) ? parsed.risk_signals.filter((s): s is string => typeof s === 'string') : []
  return {
    data: { key_insights, opportunity_signals, risk_signals },
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
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: STRATEGIC_RECOMMENDATION_SYSTEM, maxOutputTokens: 1000, model: GEMINI_MODEL })
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

/** Step 5: PM Action Plan - structured JSON */
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
  let text!: string
  let usedFallback = false
  let primaryProviderError: string | undefined
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: PM_ACTION_PLAN_SYSTEM, maxOutputTokens: 1600, model: GEMINI_MODEL })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: PM_ACTION_PLAN_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 1600 })
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
  const fallbackPm = {
    product_actions: [],
    feature_ideas: [],
    go_to_market_steps: [],
  } as {
    product_actions?: Array<{ action?: string; priority?: string; reasoning?: string }>
    feature_ideas?: string[]
    go_to_market_steps?: string[]
  }
  const parsed = parseAiJson<{
    product_actions?: Array<{ action?: string; priority?: string; reasoning?: string }>
    feature_ideas?: string[]
    go_to_market_steps?: string[]
    product_idea?: string
    target_customer?: string
    monetization?: string
    pm_action_plan?: Array<{ action_title?: string; description?: string; expected_outcome?: string; priority?: string; category?: string }>
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
    next_actions_pm?: Array<{ action?: string; why?: string; how_to_execute?: string; priority?: string; estimated_effort?: string }>
  }>(typeof text === 'string' ? text : '', fallbackPm, 'execution_layer')
  const toStrArr = (arr: unknown): string[] =>
    Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : []
  const actions = Array.isArray(parsed?.product_actions)
    ? parsed.product_actions
        .filter((a): a is { action: string; priority?: string; reasoning?: string } => typeof (a as { action?: string })?.action === 'string')
        .map((a) => ({ action: String((a as { action: string }).action), priority: (a as { priority?: string }).priority, reasoning: (a as { reasoning?: string }).reasoning }))
    : []
  const pmPlan: PMActionPlanItem[] = Array.isArray(parsed?.pm_action_plan)
    ? parsed.pm_action_plan
        .filter((a): a is { action_title: string } => typeof (a as { action_title?: string })?.action_title === 'string')
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

/** Strategy Evaluation - score each dimension 1-10 */
type StrategyEvaluationResult = {
  market_attractiveness: number
  competition_risk: number
  execution_difficulty: number
  growth_potential: number
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
  let text!: string
  const tryGemini = () =>
    generateText({ apiKey: geminiKey, prompt, systemInstruction: STRATEGY_EVALUATION_SYSTEM, maxOutputTokens: 300, model: GEMINI_MODEL })
  const tryGroq = () =>
    completeChat({ apiKey: groqKey!, messages: [{ role: 'system', content: STRATEGY_EVALUATION_SYSTEM }, { role: 'user', content: prompt }], maxTokens: 300 })
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
  } catch {
    return { market_attractiveness: 5, competition_risk: 5, execution_difficulty: 5, growth_potential: 5 }
  }
  const fallbackEval: StrategyEvaluationResult = {
    market_attractiveness: 5,
    competition_risk: 5,
    execution_difficulty: 5,
    growth_potential: 5,
  }
  const parsed = parseAiJson<StrategyEvaluationResult>(
    typeof text === 'string' ? text : '',
    fallbackEval,
    'strategy_evaluation'
  )
  return {
    market_attractiveness: clampScore(parsed.market_attractiveness),
    competition_risk: clampScore(parsed.competition_risk),
    execution_difficulty: clampScore(parsed.execution_difficulty),
    growth_potential: clampScore(parsed.growth_potential),
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

  return { pass1, summary: sanitizeDeep(summary), structured: sanitizeDeep(structured) }
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
const TIMEOUT_MESSAGE = '요청 시간이 초과되었습니다. 다시 시도해 주세요.'

function checkAborted(signal: AbortSignal | undefined): boolean {
  return !!signal?.aborted
}

export async function* runResearch(
  params: RunResearchParams
): AsyncGenerator<ResearchStreamEvent> {
  const { keyword, countryCode, userId, geminiKey, groqKey, mode: depthMode = 'standard', primaryProvider: primaryProviderParam, signal } = params
  const primaryProvider: AIPrimaryModel = primaryProviderParam ?? 'gemini'
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
  const log = (step: string, detail: string, extra?: Record<string, unknown>) => {
    console.log('[AI Timeline]', { step, detail, analysisId: analysisId.slice(0, 40) + '...', keyword, ...extra })
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
  try {
    const webResults = await searchWeb(keyword, { num: 10 })
    webContext = formatWebContext(webResults, 10)
    if (webResults.length > 0) {
      log('web_grounding', 'completed', { sourcesCount: webResults.length })
    }
  } catch (err) {
    console.warn('[AI Timeline] web search failed (continuing without)', { keyword, err })
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
  log('start', 'analysis_started')
  console.log('[AI Analysis] 시작', { keyword: cacheKey.keyword, countryCode: cacheKey.countryCode, analysisId: analysisId.slice(0, 50) + '...' })
  yield { type: 'analysis_started', analysisId }

  // Layer 1: Signal Layer - collect market signals (no AI)
  log('signal_layer', 'running')
  await upsertAnalysisTask('signal_layer', 'running', { provider: null, fallback_used: false })
  yield { type: 'task', task: 'signal_layer', status: 'running', provider: null, fallback_used: false }
  let news: NewsItem[]
  try {
    news = await fetchNewsTitles(keyword, cacheKey.countryCode)
    const publishers = [...new Set(news.map((n) => n.publisher).filter(Boolean))] as string[]
    const signalSources = publishers.length > 0 ? publishers : ['Google News', 'RSS 피드']
    const signalData = {
      signals: signalSources,
      news_activity: news.map((n) => ({ title: n.title, url: n.url, publisher: n.publisher })),
    }
    await upsertAnalysisTask('signal_layer', 'completed', { outputData: signalData, provider: null, fallback_used: false })
    log('signal_layer', 'completed', { newsCount: news.length })
    await updateProgress(1, 'analyzing')
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
    yield { type: 'task', task: 'signal_layer', status: 'failed', error: msg, provider: null, fallback_used: false }
    yield { type: 'error', message: msg, step: 'signal_layer' }
    return
  }

  const newsTitles = news.map((n) => n.title)

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'signal_layer' }
    return
  }

  // Layer 2+3: Parallel Analysis - Trend + Competition (both use keyword + news)
  log('trend_analysis', 'running (parallel)')
  log('competition_analysis', 'running (parallel)')
  await upsertAnalysisTask('trend_analysis', 'running', { provider: 'gemini', fallback_used: false })
  await upsertAnalysisTask('competition_analysis', 'running', { provider: 'gemini', fallback_used: false })
  yield { type: 'task', task: 'trend_analysis', status: 'running', provider: 'gemini', fallback_used: false }
  yield { type: 'task', task: 'competition_analysis', status: 'running', provider: 'gemini', fallback_used: false }

  const [trendSettled, compSettled] = await Promise.allSettled([
    runTrendTask(geminiKey, groqKey, keyword, newsTitles, primaryProvider, webContext),
    runCompetitionTask(geminiKey, groqKey, keyword, newsTitles, primaryProvider, webContext),
  ])

  if (trendSettled.status === 'rejected') {
    const msg = toUserFriendlyError(trendSettled.reason, '트렌드 분석 중 오류가 발생했습니다.')
    log('trend_analysis', 'failed', { error: msg, err: trendSettled.reason })
    await upsertAnalysisTask('trend_analysis', 'failed', { errorMessage: msg, provider: 'gemini', fallback_used: false })
    await updateProgress(2, 'failed')
    yield { type: 'task', task: 'trend_analysis', status: 'failed', error: msg, provider: 'gemini', fallback_used: false }
    yield { type: 'error', message: msg, step: 'trend_analysis' }
    return
  }
  if (compSettled.status === 'rejected') {
    const msg = toUserFriendlyError(compSettled.reason, '경쟁 환경 분석 중 오류가 발생했습니다.')
    log('competition_analysis', 'failed', { error: msg, err: compSettled.reason })
    await upsertAnalysisTask('competition_analysis', 'failed', { errorMessage: msg, provider: 'gemini', fallback_used: false })
    await updateProgress(3, 'failed')
    yield { type: 'task', task: 'competition_analysis', status: 'failed', error: msg, provider: 'gemini', fallback_used: false }
    yield { type: 'error', message: msg, step: 'competition_analysis' }
    return
  }

  const trendResult = trendSettled.value
  const compResult = compSettled.value
  const trendData = trendResult.trendData
  const competitionData = compResult.competitionData

  const trendProvider = primaryProvider === 'gemini' ? (trendResult.usedFallback ? 'groq' : 'gemini') : (trendResult.usedFallback ? 'gemini' : 'groq')
  const compProvider = primaryProvider === 'gemini' ? (compResult.usedFallback ? 'groq' : 'gemini') : (compResult.usedFallback ? 'gemini' : 'groq')
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

  const competitionSummary = competitionData.competitive_landscape
    .map((c) => (c.positioning ? `${c.name}: ${c.positioning}` : c.name))
    .join('. ') || competitionData.market_structure || ''

  const marketOverview = trendData.summary

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'trend_competition' }
    return
  }

  // Step 3: Insight Extraction
  log('insight_extraction', 'running')
  await upsertAnalysisTask('insight_extraction', 'running', { provider: 'gemini', fallback_used: false })
  yield { type: 'task', task: 'insight_extraction', status: 'running', provider: 'gemini', fallback_used: false }
  let insightData: InsightExtractionResult
  try {
    const insightResult = await runInsightExtractionTask(
      geminiKey,
      groqKey,
      keyword,
      marketOverview,
      competitionSummary,
      primaryProvider
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
    await upsertAnalysisTask('insight_extraction', 'failed', { errorMessage: msg, provider: 'gemini', fallback_used: false })
    yield { type: 'task', task: 'insight_extraction', status: 'failed', error: msg, provider: 'gemini', fallback_used: false }
    yield { type: 'error', message: msg, step: 'insight_extraction' }
    insightData = {
      key_insights: trendData.positive_signals,
      opportunity_signals: trendData.positive_signals,
      risk_signals: [],
    }
  }

  const stratPrimaryIsGemini = primaryProvider === 'gemini'

  // Step 4: Strategic Recommendation
  log('strategic_recommendation', 'running')
  await upsertAnalysisTask('strategy_generation', 'running', { provider: stratPrimaryIsGemini ? 'gemini' : 'groq', fallback_used: false })
  yield { type: 'task', task: 'strategy_generation', status: 'running', provider: stratPrimaryIsGemini ? 'gemini' : 'groq', fallback_used: false }
  let strategyData: StrategicRecommendationResult
  try {
    const stratResult = await runStrategicRecommendationTask(
      geminiKey,
      groqKey,
      keyword,
      marketOverview,
      competitionSummary,
      insightData,
      primaryProvider
    )
    strategyData = stratResult.data
    const stratProvider = stratPrimaryIsGemini ? (stratResult.usedFallback ? 'groq' : 'gemini') : (stratResult.usedFallback ? 'gemini' : 'groq')
    await upsertAnalysisTask('strategy_generation', 'completed', {
      outputData: strategyData,
      provider: stratProvider,
      fallback_used: stratResult.usedFallback,
      primary_provider_error: stratResult.usedFallback ? stratResult.primaryProviderError ?? null : null,
    })
    log('strategic_recommendation', 'completed')
    yield { type: 'task', task: 'strategy_generation', status: 'completed', data: strategyData, provider: stratProvider, fallback_used: stratResult.usedFallback }
  } catch (err) {
    const msg = toUserFriendlyError(err, '전략 추천 생성 중 오류가 발생했습니다.')
    log('strategy_generation', 'failed', { error: msg, err })
    await upsertAnalysisTask('strategy_generation', 'failed', { errorMessage: msg, provider: 'gemini', fallback_used: false })
    await updateProgress(4, 'failed')
    yield { type: 'task', task: 'strategy_generation', status: 'failed', error: msg, provider: 'gemini', fallback_used: false }
    yield { type: 'error', message: msg, step: 'strategy_generation' }
    return
  }

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'strategy_generation' }
    return
  }

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
  try {
    const pmResult = await runPMActionPlanTask(
      geminiKey,
      groqKey,
      keyword,
      strategyData.strategy_summary,
      opportunitiesSummary,
      risksSummary,
      primaryProvider
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

    const stratProvider = stratPrimaryIsGemini ? (pmResult.usedFallback ? 'groq' : 'gemini') : (pmResult.usedFallback ? 'gemini' : 'groq')
    await upsertAnalysisTask('execution_layer', 'completed', {
      outputData: executionData,
      provider: stratProvider,
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
      provider: stratProvider,
      fallback_used: pmResult.usedFallback,
      primaryProviderError: pmResult.usedFallback ? pmResult.primaryProviderError : undefined,
    }
  } catch (err) {
    const msg = toUserFriendlyError(err, 'PM 액션 플랜 생성 중 오류가 발생했습니다.')
    log('pm_action_plan', 'failed', { error: msg, err })
    await upsertAnalysisTask('strategy_generation', 'failed', { errorMessage: msg, provider: 'gemini', fallback_used: false })
    await upsertAnalysisTask('execution_layer', 'failed', { errorMessage: msg, provider: 'gemini', fallback_used: false })
    await updateProgress(4, 'failed')
    yield { type: 'task', task: 'strategy_generation', status: 'failed', error: msg, provider: 'gemini', fallback_used: false }
    yield { type: 'task', task: 'execution_layer', status: 'failed', error: msg, provider: 'gemini', fallback_used: false }
    yield { type: 'error', message: msg, step: 'execution_layer' }
    return
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

  let strategyEvaluation: StrategyEvaluationResult | undefined
  try {
    strategyEvaluation = await runStrategyEvaluationTask(
      geminiKey,
      groqKey,
      keyword,
      strategyData,
      competitionSummary,
      executionData,
      primaryProvider
    )
  } catch {
    strategyEvaluation = undefined
  }

  const structured: StructuredAnalysisFields = {
    market_temperature_score: trendData.market_score,
    summary_insights: strategyData.strategy_summary,
    market_summary: strategyData.market_summary,
    key_strategic_insights: strategyData.key_strategic_insights,
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
          competition_risk: strategyEvaluation.competition_risk,
          execution_difficulty: strategyEvaluation.execution_difficulty,
          growth_potential: strategyEvaluation.growth_potential,
        }
      : undefined,
  }

  // Sanitize all text fields before post-processing and yielding
  sanitizeDeep(structured)
  sanitizeDeep(fullSummary)

  // Post-processing: 기회 점수·차트 산출 (파이프라인 5단계 완료 후, done 전)
  yield { type: 'post_processing', stepId: 'key_metrics' }
  yield { type: 'pass2', structured }

  // Opportunity Score - deterministic formula (no LLM call)
  const opportunityScoreData = computeOpportunityScore({
    market_score: trendData.market_score,
    positive_signals_count: trendData.positive_signals.length,
    neutral_signals_count: trendData.neutral_signals.length,
    competitor_count: competitionData.competitive_landscape.length,
    opportunities_count: strategyData.opportunities.length,
    risks_count: strategyData.risks.length,
    product_actions_count: executionData.product_actions.length,
  })
  structured.opportunity_score = opportunityScoreData.opportunity_score
  structured.opportunity_score_breakdown = opportunityScoreData.breakdown
  structured.opportunity_score_reasoning = opportunityScoreData.score_reasoning

  if (checkAborted(signal)) {
    yield { type: 'error', message: TIMEOUT_MESSAGE, step: 'execution_layer' }
    return
  }

  // Step 4: Creative analysis
  yield { type: 'post_processing', stepId: 'creative' }
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

  console.log('[AI Analysis] 완료', { keyword: cacheKey.keyword, reportId, hasKeyMetrics: !!structured })
  yield { type: 'done', reportId, sourceLinks: news }
}
