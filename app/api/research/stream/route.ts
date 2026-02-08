import { createClient } from '@/lib/supabase/server'
import { trackUsage } from '@/lib/usage'
import { getEffectiveLicenseKeys } from '@/lib/license'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. Google Search로 최신 웹 정보를 참고한 뒤, 반드시 JSON 형식으로만 답변하세요."
const USER_PROMPT_TEMPLATE = (keyword: string) =>
  `"${keyword}"에 대한 최신 트렌드·뉴스·유저 반응을 Google Search로 검색한 뒤 분석해서, 아래 JSON만 출력해줘. ` +
  `JSON: { marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100, publicReactionTrends: "", chartData: { sentiment: { positive: 0~100, neutral: 0~100, negative: 0~100 }, impact: [ { subject: "분야명", score: 0~10 } ] }, articleSummaries: [], keyConclusions: [] }. ` +
  `keyConclusions 3개 문장, articleSummaries는 검색된 소스 순서대로 1문단씩, positive+neutral+negative 합계 100, impact 5개, publicReactionTrends 1~2문단.`

function extractJsonFromText(text: string): string {
  const trimmed = text.trim()
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
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
  let body: { keyword?: string; query?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }
  const keyword = body?.keyword ?? body?.query
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

      try {
        send('progress', { step: 'firecrawl_start' })

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: { maxOutputTokens: 3500 },
          tools: [{ googleSearchRetrieval: {} }],
        })

        const prompt = USER_PROMPT_TEMPLATE(keyword)
        const maxRetries = 3
        let responseText: string | null = null
        let responseObj: Awaited<ReturnType<typeof model.generateContent>> | null = null
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            responseObj = await model.generateContent(prompt)
            responseText = responseObj.response.text()
            break
          } catch (geminiError: unknown) {
            const msg = String((geminiError as { message?: string })?.message ?? geminiError)
            const is429 =
              msg.includes('429') ||
              msg.includes('quota') ||
              msg.includes('resource exhausted') ||
              msg.includes('rate limit')
            if (is429 && attempt < maxRetries) {
              const retryAfterSec = msg.match(/retry[- ]after[:\s]+(\d+)/i)?.[1]
              const baseWaitMs = retryAfterSec ? parseInt(retryAfterSec, 10) * 1000 : 2000 * Math.pow(2, attempt)
              const waitMs = Math.min(baseWaitMs, 60_000)
              console.warn('[Research Stream] 429, exponential backoff wait', waitMs, 'ms attempt', attempt + 1)
              await new Promise((r) => setTimeout(r, waitMs))
              continue
            }
            console.error('[Research Stream] Gemini error:', msg)
            const retryAfterSec = msg.match(/retry[- ]after[:\s]+(\d+)/i)?.[1]
            const retryDelaySec = retryAfterSec ? Math.min(parseInt(retryAfterSec, 10), 60) : 13
            send('progress', {
              step: 'error',
              error:
                msg.includes('429') || msg.includes('quota')
                  ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
                  : '린이 분석하는 중 오류가 났어요. 잠시 후 다시 시도해 주세요.',
              retryDelay: retryDelaySec,
            })
            safeClose()
            return
          }
        }

        const collectedAt = new Date().toISOString()
        const candidate = (responseObj?.response as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } } })?.candidates?.[0]
        const chunks = candidate?.groundingMetadata?.groundingChunks ?? []
        const news = chunks.map((c) => {
          const url = c.web?.uri ?? ''
          let publisher = ''
          try {
            if (url) publisher = new URL(url).hostname.replace(/^www\./, '')
          } catch {
            /* ignore */
          }
          return {
            title: (c.web?.title ?? '제목 없음').slice(0, 200),
            url,
            publisher: publisher || undefined,
            publishedAt: collectedAt,
          }
        })

        send('progress', { step: 'firecrawl_done', news })
        if (isClosed) {
          safeClose()
          return
        }
        send('progress', { step: 'gemini_start' })
        if (isClosed) {
          safeClose()
          return
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

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        let reportId: string | null = null
        if (user?.id) {
          const { data: report, error: insertError } = await supabase
            .from('reports')
            .insert({
              user_id: user.id,
              keyword: keyword.trim(),
              content: summary,
              source_links: news,
            })
            .select('id')
            .single()
          if (!insertError && report?.id) reportId = report.id
        }

        send('progress', { step: 'result', data: { ...summary, reportId } as Record<string, unknown> })
      } catch (e) {
        console.error('[Research Stream]', e)
        send('progress', {
          step: 'error',
          error: '예기치 않은 오류가 났어요. 잠시 후 다시 시도해 주세요.',
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
