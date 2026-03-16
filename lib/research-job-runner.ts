/**
 * @deprecated Job-based execution will be replaced by lib/ai/runResearch.ts streaming.
 * Use POST /api/research/run for new analyses.
 */
import Parser from 'rss-parser'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGeminiKeyForRequest, getTabProviderKeys } from '@/lib/research-keys'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { BASE_MARKDOWN_PROMPT } from '@/lib/ai/base-prompt'
import { generateText, runTabAnalysis } from '@/lib/ai'
import { PASS1_SYSTEM, buildPass1Prompt, PASS2_SYSTEM, buildPass2Prompt } from '@/lib/ai/pm-analysis-two-pass'
import {
  parsePass1Response,
  parsePass2Response,
  pass1ToSummary,
  mergePass1Pass2,
} from '@/lib/research-parser-two-pass'
import { trackUsage } from '@/lib/usage'
import { buildCacheKeyParts, isCacheValid, logCacheEvent } from '@/lib/research-cache'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TAB_SYSTEM_PROMPT = `${BASE_MARKDOWN_PROMPT}

PM 의사결정 지원용 요약입니다. 챗봇이 아닙니다. 컨설팅 보고서 수준으로, 한국 PM이 읽는 문서처럼 작성하세요.
포함할 내용: 상황 설명, 의미, 비즈니스 영향, 기회, 리스크, 전략 제안, 액션 제안. 단순 요약 금지.
Facts/Hypotheses/Inferences 구분 가능 시 해당 레이블 사용. 캐주얼·대화체·뉴스 요약 톤 금지.`

type RssItem = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; content?: string }
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

function buildCreativePrompt(keyword: string, summary: string, newsHeadlines: string): string {
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인 (news_items_ko):\n${newsHeadlines}\n\n` : ''
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

async function fetchNewsTitles(keyword: string, countryCode: string): Promise<Array<{ title: string; url: string; publisher?: string; publishedAt?: string }>> {
  const { getNewsLocale } = await import('@/lib/news-rss-locale')
  const { gl, hl, ceid } = getNewsLocale(countryCode)
  const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
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

async function updateJob(jobId: string, patch: Record<string, unknown>) {
  const supabase = createAdminClient()
  await supabase
    .from('analysis_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
}

function toErrorMessage(err: unknown, fallback: string) {
  if (!err) return fallback
  const msg = String((err as { message?: string })?.message ?? err)
  return msg.trim().length > 0 ? msg.slice(0, 500) : fallback
}

export async function runAnalysisJob(jobId: string) {
  const supabase = createAdminClient()
  const { data: job, error } = await supabase
    .from('analysis_jobs')
    .select('id, user_id, keyword, country_code, status, updated_at, report_id')
    .eq('id', jobId)
    .maybeSingle()

  if (error || !job) {
    await updateJob(jobId, { status: 'failed', error: '작업을 찾을 수 없습니다.' })
    return
  }

  if (job.status === 'cancelled' || job.status === 'succeeded') {
    return
  }

  const userId = job.user_id as string
  const keyword = (job.keyword ?? '').trim()
  const countryCode = (job.country_code ?? 'KR').trim() || 'KR'
  if (!userId || !keyword) {
    await updateJob(jobId, { status: 'failed', error: '작업 정보가 올바르지 않습니다.' })
    return
  }

  const cacheKey = buildCacheKeyParts(userId, keyword, countryCode)
  const { data: cacheRow } = await supabase
    .from('research_history')
    .select('report_id, updated_at')
    .eq('user_id', cacheKey.userId)
    .eq('keyword', cacheKey.keyword)
    .eq('country_code', cacheKey.countryCode)
    .maybeSingle()

  if (cacheRow?.report_id && isCacheValid(cacheRow.updated_at)) {
    logCacheEvent('hit', {
      scope: 'stream_report',
      keyword: cacheKey.keyword,
      countryCode: cacheKey.countryCode,
      source: 'report_id',
      detail: 'cached',
      skippedAi: true,
      updatedAt: cacheRow.updated_at,
    })
    await updateJob(jobId, {
      status: 'succeeded',
      progress_step: 'cached',
      report_id: cacheRow.report_id,
      error: null,
    })
    return
  }

  await updateJob(jobId, { status: 'running', progress_step: 'news', error: null })

  const { gemini, canSearch } = await getGeminiKeyForRequest(supabase, userId)
  if (!canSearch || !gemini) {
    await updateJob(jobId, { status: 'failed', error: '설정에서 API 키를 등록한 뒤 분석을 사용할 수 있습니다.' })
    return
  }

  try {
    const news = await fetchNewsTitles(keyword, countryCode)
    await updateJob(jobId, { progress_step: 'gemini' })

    const newsTitles = news.map((n) => n.title)
    const pass1Prompt = buildPass1Prompt(keyword, newsTitles)
    const pass1Text = await generateText({
      apiKey: gemini,
      prompt: pass1Prompt,
      systemInstruction: PASS1_SYSTEM,
      maxOutputTokens: 600,
      model: GEMINI_MODEL,
    })

    await updateJob(jobId, { progress_step: 'parse_json' })
    const pass1 = parsePass1Response(typeof pass1Text === 'string' ? pass1Text : '')
    if (!pass1) {
      await updateJob(jobId, { status: 'failed', error: '1차 분석 형식이 올바르지 않아요. 다시 시도해 주세요.' })
      return
    }

    const s = pass1ToSummary(pass1, news.map(() => ''))
    const summary = {
      marketNews: s.marketNews,
      painPoints: s.painPoints,
      competitorTrends: s.competitorTrends,
      sentiment: s.sentiment,
      publicReactionTrends: s.publicReactionTrends,
      chartData: s.chartData,
      articleSummaries: s.articleSummaries,
      keyConclusions: s.keyConclusions,
    }

    const keyMetricsPass1 = {
      chartData: summary.chartData,
      keyConclusions: summary.keyConclusions,
      sentiment: summary.sentiment,
      market_temperature_score: pass1.temperature,
      summary_insights: pass1.summary,
      facts: pass1.insights,
    }

    await updateJob(jobId, { progress_step: 'report_db' })
    let reportId: string | null = null
    const { data: report, error: insertError } = await supabase
      .from('reports')
      .insert({
        user_id: userId,
        keyword,
        content: summary,
        source_links: news,
        ai_responses: {},
      })
      .select('id')
      .single()
    if (!insertError && report?.id) reportId = report.id

    await trackUsage('gemini')

    if (reportId) {
      await supabase.from('research_history').upsert(
        {
          user_id: cacheKey.userId,
          keyword: cacheKey.keyword,
          country_code: cacheKey.countryCode,
          report_id: reportId,
          key_metrics: keyMetricsPass1,
          analysis_status: 'analyzing',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,keyword,country_code' }
      )
      await updateJob(jobId, { report_id: reportId, progress_step: 'pass2' })
    }

    const pass2Prompt = buildPass2Prompt(keyword, newsTitles, pass1.summary)
    const pass2Text = await generateText({
      apiKey: gemini,
      prompt: pass2Prompt,
      systemInstruction: PASS2_SYSTEM,
      maxOutputTokens: 1200,
      model: GEMINI_MODEL,
    })

    const pass2 = parsePass2Response(typeof pass2Text === 'string' ? pass2Text : '')
    await trackUsage('gemini')
    const { summary: fullSummary, structured } = mergePass1Pass2(pass1, pass2)
    const articleSummaries = fullSummary.articleSummaries.slice(0, news.length)
    const fullSum = {
      marketNews: fullSummary.marketNews,
      painPoints: fullSummary.painPoints,
      competitorTrends: fullSummary.competitorTrends,
      sentiment: fullSummary.sentiment,
      publicReactionTrends: fullSummary.publicReactionTrends,
      chartData: fullSummary.chartData,
      articleSummaries,
      keyConclusions: fullSummary.keyConclusions,
    }

    if (reportId) {
      const keyMetrics = {
        chartData: fullSum.chartData,
        keyConclusions: fullSum.keyConclusions,
        sentiment: fullSum.sentiment,
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
        scope: 'stream_report',
        keyword: cacheKey.keyword,
        countryCode: cacheKey.countryCode,
        detail: 'key_metrics',
      })
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
      if (typeof structured?.confidence_score === 'number') upsertPayload.confidence_score = structured.confidence_score
      if (typeof structured?.market_temperature_score === 'number') upsertPayload.market_temperature_score = structured.market_temperature_score
      if (structured?.summary_insights) upsertPayload.summary_insights = structured.summary_insights
      await supabase.from('research_history').upsert(upsertPayload, { onConflict: 'user_id,keyword,country_code' })
      await supabase.from('reports').update({ content: fullSum }).eq('id', reportId)
    }

    // Creative analysis: run tab analysis in background and write to research_history.
    const tabKeys = getTabProviderKeys()
    const provider =
      tabKeys.groq && tabKeys.gemini
        ? 'all'
        : tabKeys.gemini
          ? 'gemini'
          : tabKeys.groq
            ? 'groq'
            : 'none'
    if (provider !== 'none') {
      await updateJob(jobId, { progress_step: 'creative' })
      const summaryText = buildSummaryText(fullSum)
      const newsHeadlines = news.map((n) => n.title).join('\n')
      const userPrompt = buildCreativePrompt(keyword, summaryText, newsHeadlines)
      const creative = await runTabAnalysis({
        groqKey: tabKeys.groq,
        geminiKey: tabKeys.gemini,
        provider,
        systemPrompt: TAB_SYSTEM_PROMPT,
        userPrompt,
      })

      if (creative.groqText || creative.geminiText) {
        const { data: existing } = await supabase
          .from('research_history')
          .select('analysis_groq, analysis_gemini')
          .eq('user_id', cacheKey.userId)
          .eq('keyword', cacheKey.keyword)
          .eq('country_code', cacheKey.countryCode)
          .maybeSingle()

        const nextGroq = {
          ...toRecord(existing?.analysis_groq),
          ...(creative.groqText ? { creative: creative.groqText } : {}),
        }
        const nextGemini = {
          ...toRecord(existing?.analysis_gemini),
          ...(creative.geminiText ? { creative: creative.geminiText } : {}),
        }
        const analysisInsight = creative.geminiText ?? creative.groqText ?? null

        await supabase.from('research_history').upsert(
          {
            user_id: cacheKey.userId,
            keyword: cacheKey.keyword,
            country_code: cacheKey.countryCode,
            report_id: reportId,
            analysis_groq: nextGroq,
            analysis_gemini: nextGemini,
            analysis_insight: analysisInsight,
            analysis_status: 'completed',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,keyword,country_code' }
        )
      }
    }

    await updateJob(jobId, {
      status: 'succeeded',
      progress_step: 'done',
      report_id: reportId,
      error: null,
    })
  } catch (err) {
    console.error('[ResearchJob] failed:', err)
    await updateJob(jobId, {
      status: 'failed',
      error: toErrorMessage(err, '분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.'),
    })
  }
}
