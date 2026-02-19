import { createClient } from '@/lib/supabase/server'
import { trackUsage } from '@/lib/usage'
import Parser from 'rss-parser'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { RATE_LIMIT_USER_MESSAGE } from '@/lib/gemini-retry'
import { logCacheEvent, buildCacheKeyParts } from '@/lib/research-cache'
import { getGeminiKeyForRequest } from '@/lib/research-keys'
import { parseInitialResearchResponse, type StructuredAnalysisFields } from '@/lib/research-parser'
import { generateText } from '@/lib/ai'
import { INITIAL_RESEARCH_SYSTEM, buildInitialResearchUserPrompt } from '@/lib/ai/pm-analysis-prompts'

export const runtime = 'nodejs'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type RssItem = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; content?: string }
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

/** 키워드로 구글 뉴스 RSS 조회 후 제목·URL 반환 (한국어 헤드라인 = news_items_ko) */
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

type StreamEvent =
  | { step: 'news_start' }
  | { step: 'news_done'; news: Array<{ title: string; url: string; content?: string }> }
  | { step: 'gemini_start' }
  | { step: 'chart_ready' }
  | { step: 'gemini_done' }
  | { step: 'result'; data: Record<string, unknown> }
  | { step: 'error'; error: string; retryDelay?: number }

function sseMessage(event: string, data: StreamEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

/** SSE stream: fetch news (RSS) → Gemini analysis → parse research JSON → upsert research_history → send result. */
export async function POST(req: Request) {
  let body: { keyword?: string; query?: string; country_code?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const keyword = body?.keyword ?? body?.query
  const countryCode = typeof body?.country_code === 'string' ? body.country_code.trim() || 'KR' : 'KR'
  if (!keyword || typeof keyword !== 'string') {
    return new Response(JSON.stringify({ error: 'keyword required' }), { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { gemini: apiKey, canSearch } = await getGeminiKeyForRequest(supabase, user?.id)
  if (!canSearch) {
    return new Response(
      JSON.stringify({
        error: '설정에서 API 키를 등록한 뒤 분석을 사용할 수 있습니다.',
      }),
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()
  const abortSignal = req.signal

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false

      const safeClose = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch (_) {
          /* already closed */
        }
      }

      const send = (event: string, payload: StreamEvent) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(sseMessage(event, payload)))
        } catch (_) {
          isClosed = true
          try {
            controller.close()
          } catch (_) {}
        }
      }

      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          isClosed = true
          try {
            controller.close()
          } catch (_) {}
        })
      }

      let currentStep = 'news'
      try {
        send('progress', { step: 'news_start' })
        const news = await fetchNewsTitles(keyword)
        send('progress', { step: 'news_done', news: news.map((n) => ({ title: n.title, url: n.url })) })
        if (isClosed) {
          safeClose()
          return
        }
        if (user?.id) {
          const cacheKey = buildCacheKeyParts(user.id, keyword, countryCode)
          await supabase.from('research_history').upsert(
            {
              user_id: cacheKey.userId,
              keyword: cacheKey.keyword,
              country_code: cacheKey.countryCode,
              analysis_status: 'analyzing',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,keyword,country_code' }
          )
        }
        send('progress', { step: 'gemini_start' })
        if (isClosed) {
          safeClose()
          return
        }

        currentStep = 'gemini'
        const newsTitles = news.map((n) => n.title)
        const prompt = buildInitialResearchUserPrompt(keyword, newsTitles)
        let responseText: string | null = null
        try {
          responseText = await generateText({
            apiKey,
            prompt,
            systemInstruction: INITIAL_RESEARCH_SYSTEM,
            maxOutputTokens: 3500,
            model: GEMINI_MODEL,
          })
        } catch (geminiError: unknown) {
          const msg = String((geminiError as { message?: string })?.message ?? geminiError)
          console.log('[Research Stream] Gemini error (all retries exhausted)', msg)
          // retryDelay: client will show toast and auto-retry once after N seconds (cost: one more attempt).
          send('progress', {
            step: 'error',
            error: RATE_LIMIT_USER_MESSAGE,
            retryDelay: 13,
          })
          safeClose()
          return
        }

        send('progress', { step: 'gemini_done' })
        if (isClosed) {
          safeClose()
          return
        }
        if (!responseText) {
          send('progress', { step: 'error', error: '분석 결과를 생성하지 못했습니다. 다시 시도해 주세요.' })
          safeClose()
          return
        }

        send('progress', { step: 'chart_ready' })
        if (isClosed) {
          safeClose()
          return
        }
        await trackUsage('gemini')

        currentStep = 'parse_json'
        const parsed = parseInitialResearchResponse(responseText, {
          repair: true,
          articleSummaries: news.map(() => ''),
        })
        if (!parsed.ok) {
          send('progress', { step: 'error', error: `${parsed.error} 다시 시도해 주세요.` })
          safeClose()
          return
        }

        const s = parsed.summary
        const structured = parsed.ok && 'structured' in parsed ? (parsed.structured as StructuredAnalysisFields) : undefined
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

        currentStep = 'report_db'
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        let reportId: string | null = null
        if (user?.id) {
          try {
            const { data: report, error: insertError } = await supabase
              .from('reports')
              .insert({
                user_id: user.id,
                keyword: keyword.trim(),
                content: summary,
                source_links: news,
                ai_responses: {},
              })
              .select('id')
              .single()
            if (!insertError && report?.id) {
              reportId = report.id
              const keyMetrics = {
                chartData: summary.chartData,
                keyConclusions: summary.keyConclusions,
                sentiment: summary.sentiment,
                ...(structured && {
                  analysis_target: structured.analysis_target,
                  confidence_score: structured.confidence_score,
                  market_temperature_score: structured.market_temperature_score,
                  facts: structured.facts,
                  hypotheses: structured.hypotheses,
                  inferences: structured.inferences,
                  positive_signals: structured.positive_signals,
                  neutral_signals: structured.neutral_signals,
                  negative_risks: structured.negative_risks,
                  summary_insights: structured.summary_insights,
                }),
              }
              // Same cache key as insights/tab. TTL: RESEARCH_CACHE_TTL_MS (24h). Owner: research_history.
              const cacheKey = buildCacheKeyParts(user.id, keyword, countryCode)
              logCacheEvent('write', {
                scope: 'stream_report',
                keyword: cacheKey.keyword,
                countryCode: cacheKey.countryCode,
                detail: 'key_metrics',
              })
              type ResearchHistoryRow = {
                user_id: string
                keyword: string
                country_code: string
                report_id: string | null
                key_metrics: unknown
                analysis_status: string
                analysis_target?: string
                confidence_score?: number
                market_temperature_score?: number
                summary_insights?: string
                updated_at: string
              }
              const upsertPayload: ResearchHistoryRow = {
                user_id: cacheKey.userId,
                keyword: cacheKey.keyword,
                country_code: cacheKey.countryCode,
                report_id: report.id,
                key_metrics: keyMetrics,
                analysis_status: 'completed',
                updated_at: new Date().toISOString(),
              }
              if (structured?.analysis_target) upsertPayload.analysis_target = structured.analysis_target
              if (typeof structured?.confidence_score === 'number') upsertPayload.confidence_score = structured.confidence_score
              if (typeof structured?.market_temperature_score === 'number') upsertPayload.market_temperature_score = structured.market_temperature_score
              if (structured?.summary_insights) upsertPayload.summary_insights = structured.summary_insights
              await supabase.from('research_history').upsert(upsertPayload, { onConflict: 'user_id,keyword,country_code' })
            } else if (insertError) console.warn('[Research Stream] Report insert failed (컬럼 확인):', insertError.message)
          } catch (insertErr) {
            console.warn('[Research Stream] Report insert:', insertErr)
          }
        }

        send('progress', { step: 'result', data: { ...summary, reportId, source_links: news, analysis_status: 'completed' } as Record<string, unknown> })
      } catch (e) {
        const stepLabels: Record<string, string> = {
          news: '뉴스 수집',
          gemini: 'Gemini 초기 시장 분석',
          parse_json: '분석 결과 JSON 파싱',
          report_db: '리포트/DB 저장',
        }
        const stepLabel = stepLabels[currentStep] ?? currentStep
        console.error('[Research Stream] Error at step:', stepLabel, currentStep, e)
        if (user?.id) {
          const failKey = buildCacheKeyParts(user.id, keyword, countryCode)
          await supabase.from('research_history').upsert(
            {
              user_id: failKey.userId,
              keyword: failKey.keyword,
              country_code: failKey.countryCode,
              analysis_status: 'failed',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,keyword,country_code' }
          )
        }
        send('progress', {
          step: 'error',
          error: '분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        })
      }
      if (!isClosed) {
        safeClose()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    },
  })
}
