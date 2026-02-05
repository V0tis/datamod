import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const MAX_CHARS_PER_SOURCE = 2000
const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. 반드시 JSON 형식으로만 답변하세요."
const USER_PROMPT_PREFIX = '다음 데이터를 분석해 JSON으로 출력해: '
const USER_PROMPT_SUFFIX =
  '. JSON 구조는 반드시 다음을 포함해: { marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100, publicReactionTrends: "", chartData: { sentiment: { positive: 0~100, neutral: 0~100, negative: 0~100 }, impact: [ { subject: "분야명", score: 0~10 } ] } }. positive+neutral+negative 합계는 100이 되게 하고, impact에는 경제/사회/기술/정치/환경 등 관련 분야 5개 정도의 subject와 0~10 점수 score를 넣어줘. publicReactionTrends에는 이 이슈에 대한 대중 예상 반응과 온라인 트렌드 분석을 1~2문단으로 작성해줘.'

function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildSourceSummary(
  item: {
    metadata?: { title?: string; description?: string }
    description?: string
    snippet?: string
    markdown?: string
    content?: string
  },
  maxChars: number
): string {
  const preferred =
    item.metadata?.description ?? item.metadata?.title ?? item.description ?? item.snippet ?? ''
  const preferredNorm = normalizeText(preferred)
  if (preferredNorm.length >= 50) return preferredNorm.slice(0, maxChars)
  const full = item.markdown ?? item.content ?? ''
  return normalizeText(full).slice(0, maxChars)
}

function extractJsonFromText(text: string): string {
  const trimmed = text.trim()
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  return trimmed
}

type StreamEvent =
  | { step: 'firecrawl_start' }
  | { step: 'firecrawl_done'; news: Array<{ title: string; url: string }> }
  | { step: 'gemini_start' }
  | { step: 'gemini_done' }
  | { step: 'result'; data: Record<string, unknown> }
  | { step: 'error'; error: string }

function sseMessage(event: string, data: StreamEvent): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_GENERATIVE_AI_API_KEY is not set' }),
      { status: 500 }
    )
  }

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

        const firecrawlApiKey = process.env.FIRECRAWL_API_KEY ?? ''
        const firecrawlBody = JSON.stringify({
          query: `${keyword} 최신 트렌드 유저 반응`,
          searchOptions: { limit: 5 },
        })

        const maxFirecrawlRetries = 2
        let searchRes: Response | null = null
        for (let attempt = 0; attempt <= maxFirecrawlRetries; attempt++) {
          try {
            searchRes = await fetch('https://api.firecrawl.dev/v0/search', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${firecrawlApiKey}`,
                'User-Agent': 'RinAI-Research/1.0',
              },
              body: firecrawlBody,
              keepalive: true,
              signal: AbortSignal.timeout(30_000),
            })
            break
          } catch (fetchErr: unknown) {
            const errMsg = String((fetchErr as { message?: string })?.message ?? fetchErr)
            const isSocketError =
              errMsg.includes('UND_ERR_SOCKET') ||
              errMsg.includes('other side closed') ||
              errMsg.includes('ECONNRESET') ||
              errMsg.includes('ETIMEDOUT') ||
              errMsg.includes('socket hang up')
            if (isSocketError && attempt < maxFirecrawlRetries) {
              await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
              continue
            }
            console.error('[Research Stream] Firecrawl fetch error:', errMsg)
            send('progress', {
              step: 'error',
              error: '검색 서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요.',
            })
            safeClose()
            return
          }
        }

        if (searchRes == null) {
          send('progress', { step: 'error', error: '검색 요청에 실패했어요.' })
          safeClose()
          return
        }

        if (isClosed) {
          safeClose()
          return
        }
        if (!searchRes.ok) {
          const errText = await searchRes.text()
          console.error('[Research Stream] Firecrawl failed:', searchRes.status, errText)
          send('progress', {
            step: 'error',
            error: '검색 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          })
          safeClose()
          return
        }

        const searchData = (await searchRes.json()) as {
          data?: Array<{
            url?: string
            markdown?: string
            content?: string
            metadata?: { title?: string; description?: string; language?: string; sourceURL?: string }
          }>
        }
        const rawItems = (searchData.data ?? []).slice(0, 5)
        const MAX_CONTENT_LENGTH = 3500
        const news = rawItems.map((d) => {
          const title =
            d.metadata?.title ?? d.metadata?.description ?? (d as { description?: string }).description ?? (d as { snippet?: string }).snippet ?? '제목 없음'
          const rawContent = d.markdown ?? d.content ?? ''
          const content = normalizeText(rawContent).slice(0, MAX_CONTENT_LENGTH)
          return {
            title: normalizeText(title).slice(0, 200),
            url: typeof d.url === 'string' ? d.url : '',
            content: content || undefined,
          }
        })

        send('progress', { step: 'firecrawl_done', news })
        if (isClosed) {
          safeClose()
          return
        }
        send('progress', { step: 'gemini_start' })

        const sourceTexts = rawItems
          .map((d) => buildSourceSummary(d, MAX_CHARS_PER_SOURCE))
          .filter((s) => s.length > 0)
        const context = sourceTexts.length > 0 ? sourceTexts.join('\n\n') : '데이터 없음'
        const prompt = USER_PROMPT_PREFIX + context + USER_PROMPT_SUFFIX

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: { maxOutputTokens: 1500 },
        })

        const maxRetries = 2
        let responseText: string | null = null
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const result = await model.generateContent(prompt)
            responseText = result.response.text()
            break
          } catch (geminiError: unknown) {
            const msg = String((geminiError as { message?: string })?.message ?? geminiError)
            const is429 =
              msg.includes('429') ||
              msg.includes('quota') ||
              msg.includes('resource exhausted') ||
              msg.includes('rate limit')
            if (is429 && attempt < maxRetries) {
              const retrySec =
                parseInt(msg.match(/retry[- ]after[:\s]+(\d+)/i)?.[1] ?? '60', 10) || 60
              const waitMs = Math.min(retrySec * 1000, 120_000)
              await new Promise((r) => setTimeout(r, waitMs))
              continue
            }
            console.error('[Research Stream] Gemini error:', msg)
            send('progress', {
              step: 'error',
              error:
                msg.includes('429') || msg.includes('quota')
                  ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
                  : '린이 분석하는 중 오류가 났어요. 잠시 후 다시 시도해 주세요.',
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

        const rawJson = extractJsonFromText(responseText)
        let parsed: {
          marketNews?: string[]
          painPoints?: string[]
          competitorTrends?: string
          sentiment?: number
          publicReactionTrends?: string
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

        const summary = {
          marketNews: Array.isArray(parsed.marketNews) ? parsed.marketNews : [],
          painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
          competitorTrends:
            typeof parsed.competitorTrends === 'string' ? parsed.competitorTrends : '',
          sentiment,
          publicReactionTrends:
            typeof parsed.publicReactionTrends === 'string' ? parsed.publicReactionTrends : '',
          chartData,
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
