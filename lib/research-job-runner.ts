import Parser from 'rss-parser'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGeminiKeyForRequest, getTabProviderKeys } from '@/lib/research-keys'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { generateText, runTabAnalysis } from '@/lib/ai'
import { parseInitialResearchResponse } from '@/lib/research-parser'
import { INITIAL_RESEARCH_SYSTEM, buildInitialResearchUserPrompt } from '@/lib/ai/pm-analysis-prompts'
import { trackUsage } from '@/lib/usage'
import { buildCacheKeyParts, isCacheValid, logCacheEvent } from '@/lib/research-cache'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const TAB_SYSTEM_PROMPT =
  '시장 분석 및 인사이트를 마크다운 형식으로 요약. 중요 키워드는 **강조**. Facts/Hypotheses/Inferences 구분 가능 시 해당 레이블 사용. 질문·대화형 표현 금지.'

type RssItem = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; content?: string }
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

function buildCreativePrompt(keyword: string, summary: string, newsHeadlines: string): string {
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인 (news_items_ko):\n${newsHeadlines}\n\n` : ''
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

async function fetchNewsTitles(keyword: string): Promise<Array<{ title: string; url: string; publisher?: string; publishedAt?: string }>> {
  const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`
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
    const news = await fetchNewsTitles(keyword)
    await updateJob(jobId, { progress_step: 'gemini' })

    const newsTitles = news.map((n) => n.title)
    const prompt = buildInitialResearchUserPrompt(keyword, newsTitles)
    const responseText = await generateText({
      apiKey: gemini,
      prompt,
      systemInstruction: INITIAL_RESEARCH_SYSTEM,
      maxOutputTokens: 3500,
      model: GEMINI_MODEL,
    })

    await updateJob(jobId, { progress_step: 'parse_json' })
    const parsed = parseInitialResearchResponse(responseText ?? '', {
      repair: true,
      articleSummaries: news.map(() => ''),
    })
    if (!parsed.ok) {
      await updateJob(jobId, { status: 'failed', error: `${parsed.error} 다시 시도해 주세요.` })
      return
    }

    const s = parsed.summary
    const articleSummaries = s.articleSummaries.slice(0, news.length)
    const summary = {
      marketNews: s.marketNews,
      painPoints: s.painPoints,
      competitorTrends: s.competitorTrends,
      sentiment: s.sentiment,
      publicReactionTrends: s.publicReactionTrends,
      chartData: s.chartData,
      articleSummaries,
      keyConclusions: s.keyConclusions,
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
      const keyMetrics = {
        chartData: summary.chartData,
        keyConclusions: summary.keyConclusions,
        sentiment: summary.sentiment,
      }
      logCacheEvent('write', {
        scope: 'stream_report',
        keyword: cacheKey.keyword,
        countryCode: cacheKey.countryCode,
        detail: 'key_metrics',
      })
      // State: persist analysis_status='completed'; UI trusts this, never infers from partial data.
      await supabase.from('research_history').upsert(
        {
          user_id: cacheKey.userId,
          keyword: cacheKey.keyword,
          country_code: cacheKey.countryCode,
          report_id: reportId,
          key_metrics: keyMetrics,
          analysis_status: 'completed',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,keyword,country_code' }
      )
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
      const summaryText = buildSummaryText(summary)
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
