import { createClient } from '@/lib/supabase/server'
import { trackUsage } from '@/lib/usage'
import { getEffectiveLicenseKeys } from '@/lib/license'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Parser from 'rss-parser'
import { GEMINI_MODEL } from '@/lib/gemini-config'

export const runtime = 'nodejs'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. 제공된 실시간 뉴스 제목들만 참고하여 분석한 뒤, 반드시 JSON 형식으로만 답변하세요."

function buildUserPrompt(keyword: string, newsTitles: string[]): string {
  const newsBlock =
    newsTitles.length > 0
      ? `\n\n[실시간 뉴스 제목 (news_items_ko)]\n${newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
      : '\n\n'
  return (
    `"${keyword}"에 대해 위 실시간 뉴스 제목들을 참고하여 분석한 뒤, 아래 JSON만 출력해줘.` +
    newsBlock +
    `JSON 형식: { marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100, publicReactionTrends: "", chartData: { sentiment: { positive: 0~100, neutral: 0~100, negative: 0~100 }, impact: [ { subject: "분야명", score: 0~10 } ] }, articleSummaries: [], keyConclusions: [] }. ` +
    `규칙: keyConclusions 3개 문장, articleSummaries는 뉴스 순서대로 1문단씩(없으면 빈 배열), positive+neutral+negative 합계 100, impact 5개, publicReactionTrends 1~2문단.`
  )
}

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

/** Gemini가 ```json ... ``` 또는 ``` ... ``` 로 감싼 경우 제거 후 순수 JSON만 반환 */
function extractJsonFromText(text: string): string {
  const trimmed = text.trim()
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  if (trimmed.startsWith('```')) {
    const afterOpen = trimmed.replace(/^```(?:json)?\s*\n?/i, '')
    const closeIdx = afterOpen.indexOf('```')
    if (closeIdx !== -1) return afterOpen.slice(0, closeIdx).trim()
    return afterOpen.trim()
  }
  return trimmed
}

type StreamEvent =
  | { step: 'firecrawl_start' }
  | { step: 'firecrawl_done'; news: Array<{ title: string; url: string; content?: string }> }
  | { step: 'gemini_start' }
  | { step: 'chart_ready' }
  | { step: 'gemini_done' }
  | { step: 'result'; data: Record<string, unknown> }
  | { step: 'error'; error: string; retryDelay?: number }

function sseMessage(event: string, data: StreamEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let userGemini: string | null = null
  if (user?.id) {
    const { data: row } = await supabase
      .from('user_settings')
      .select('gemini_api_key')
      .eq('user_id', user.id)
      .maybeSingle()
    userGemini = row?.gemini_api_key ?? null
  }
  const effective = getEffectiveLicenseKeys(userGemini)
  const apiKey = effective.gemini
  if (!effective.canSearch) {
    return new Response(
      JSON.stringify({
        error: '키를 등록해 주세요. 설정에서 API 키를 등록하면 분석을 사용할 수 있어요.',
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

      let currentStep = 'firecrawl'
      try {
        send('progress', { step: 'firecrawl_start' })
        const news = await fetchNewsTitles(keyword)
        send('progress', { step: 'firecrawl_done', news: news.map((n) => ({ title: n.title, url: n.url })) })
        if (isClosed) {
          safeClose()
          return
        }
        send('progress', { step: 'gemini_start' })
        if (isClosed) {
          safeClose()
          return
        }

        currentStep = 'gemini'
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: { maxOutputTokens: 3500 },
        })
        const newsTitles = news.map((n) => n.title)
        const prompt = buildUserPrompt(keyword, newsTitles)
        const maxRetries = 1
        let responseText: string | null = null
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await model.generateContent(prompt)
            responseText = result.response.text()
            break
          } catch (geminiError: unknown) {
            const msg = String((geminiError as { message?: string })?.message ?? geminiError)
            console.log('[Research Stream] Gemini error', { attempt, msg })
            const is429 =
              msg.includes('429') ||
              msg.includes('quota') ||
              msg.includes('resource exhausted') ||
              msg.includes('rate limit')
            if (is429) {
              send('progress', {
                step: 'error',
                error: '현재 요청이 많아 잠시 후 다시 시도해 주세요.',
                retryDelay: 13,
              })
              safeClose()
              return
            }
            if (attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)))
              continue
            }
            send('progress', {
              step: 'error',
              error: '분석을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
              retryDelay: 13,
            })
            safeClose()
            return
          }
        }

        send('progress', { step: 'gemini_done' })
        if (isClosed) {
          safeClose()
          return
        }
        if (!responseText) {
          send('progress', { step: 'error', error: '분석 결과를 생성하지 못했어요.' })
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
        const rawJson = extractJsonFromText(responseText)
        let parsed: {
          marketNews?: string[]
          painPoints?: string[]
          competitorTrends?: string
          sentiment?: number
          publicReactionTrends?: string
          articleSummaries?: string[]
          keyConclusions?: string[]
          chartData?: {
            sentiment?: { positive?: number; neutral?: number; negative?: number }
            impact?: Array<{ subject?: string; score?: number }>
          }
        }
        try {
          parsed = JSON.parse(rawJson) as typeof parsed
        } catch {
          send('progress', { step: 'error', error: '분석 결과 형식이 올바르지 않아요.' })
          safeClose()
          return
        }

        const sentiment =
          typeof parsed.sentiment === 'number'
            ? Math.min(100, Math.max(0, parsed.sentiment))
            : 0
        const sd = parsed.chartData?.sentiment
        const positive = Math.min(100, Math.max(0, typeof sd?.positive === 'number' ? sd.positive : 65))
        const neutral = Math.min(100, Math.max(0, typeof sd?.neutral === 'number' ? sd.neutral : 20))
        const negative = Math.min(100, Math.max(0, typeof sd?.negative === 'number' ? sd.negative : 15))
        const sum = positive + neutral + negative
        const chartSentiment = sum > 0
          ? {
              positive: Math.round((positive / sum) * 100),
              neutral: Math.round((neutral / sum) * 100),
              negative: Math.round((negative / sum) * 100),
            }
          : { positive: 65, neutral: 20, negative: 15 }
        const rawImpact = Array.isArray(parsed.chartData?.impact) ? parsed.chartData.impact : []
        const impactList = rawImpact
          .filter((i): i is { subject: string; score: number } => typeof i?.subject === 'string' && typeof i?.score === 'number')
          .map((i) => ({ subject: i.subject, score: Math.min(10, Math.max(0, i.score)) }))
          .slice(0, 8)
        const chartImpact =
          impactList.length > 0
            ? impactList
            : [
                { subject: '경제', score: 5 },
                { subject: '사회', score: 5 },
                { subject: '기술', score: 5 },
                { subject: '정치', score: 5 },
                { subject: '환경', score: 5 },
              ]
        const chartData = { sentiment: chartSentiment, impact: chartImpact }

        const articleSummaries = Array.isArray(parsed.articleSummaries)
          ? parsed.articleSummaries.filter((s): s is string => typeof s === 'string').slice(0, news.length)
          : []
        const keyConclusions = Array.isArray(parsed.keyConclusions)
          ? parsed.keyConclusions.filter((s): s is string => typeof s === 'string').slice(0, 3)
          : (Array.isArray(parsed.marketNews) ? parsed.marketNews : []).slice(0, 3)

        const summary = {
          marketNews: Array.isArray(parsed.marketNews) ? parsed.marketNews : [],
          painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
          competitorTrends:
            typeof parsed.competitorTrends === 'string' ? parsed.competitorTrends : '',
          sentiment,
          publicReactionTrends:
            typeof parsed.publicReactionTrends === 'string' ? parsed.publicReactionTrends : '',
          chartData,
          articleSummaries,
          keyConclusions,
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
              }
              await supabase.from('research_history').upsert(
                {
                  user_id: user.id,
                  keyword: keyword.trim(),
                  country_code: countryCode,
                  report_id: report.id,
                  key_metrics: keyMetrics,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: ['user_id', 'keyword', 'country_code'] }
              )
            } else if (insertError) console.warn('[Research Stream] Report insert failed (컬럼 확인):', insertError.message)
          } catch (insertErr) {
            console.warn('[Research Stream] Report insert:', insertErr)
          }
        }

        send('progress', { step: 'result', data: { ...summary, reportId, source_links: news } as Record<string, unknown> })
      } catch (e) {
        const stepLabels: Record<string, string> = {
          firecrawl: 'Firecrawl 뉴스 수집',
          gemini: 'Gemini 초기 시장 분석',
          parse_json: '분석 결과 JSON 파싱',
          report_db: '리포트/DB 저장',
        }
        const stepLabel = stepLabels[currentStep] ?? currentStep
        console.error('[Research Stream] Error at step:', stepLabel, currentStep, e)
        send('progress', {
          step: 'error',
          error: '분석을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.',
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
