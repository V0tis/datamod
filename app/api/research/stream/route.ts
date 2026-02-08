import { createClient } from '@/lib/supabase/server'
import { trackUsage } from '@/lib/usage'
import { getEffectiveLicenseKeys } from '@/lib/license'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const MAX_CHARS_PER_SOURCE = 2000
const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. 반드시 JSON 형식으로만 답변하세요."
const USER_PROMPT_PREFIX = '다음 데이터를 분석해 JSON으로 출력해: '
const USER_PROMPT_SUFFIX =
  '. JSON 구조는 반드시 다음을 포함해: { marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100, publicReactionTrends: "", chartData: { sentiment: { positive: 0~100, neutral: 0~100, negative: 0~100 }, impact: [ { subject: "분야명", score: 0~10 } ] }, articleSummaries: [], keyConclusions: [] }. keyConclusions에는 이 이슈의 핵심 결론을 정확히 3개 문장으로 넣어줘(배열 길이 3). 위에서 제시한 소스 순서대로 articleSummaries 1문단씩, positive+neutral+negative 합계 100, impact 5개, publicReactionTrends 1~2문단.'

function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 마크다운 링크 패턴 [text](url) 개수 */
function countMarkdownLinks(line: string): number {
  return (line.match(/\]\s*\(\s*https?:\/\/[^\s)]+/gi) ?? []).length
}

/** 한 줄이 링크만 있는지 (네비/사이드바용) */
function isLinkOnlyLine(line: string): boolean {
  const t = line.trim()
  if (!t) return true
  const linkCount = countMarkdownLinks(t)
  const approxLinkLength = (t.match(/\]\s*\(\s*[^)]+\)/g) ?? []).join('').length
  return linkCount >= 1 && approxLinkLength >= t.length * 0.5
}

/**
 * 스크래핑된 본문에서 네비/사이드바(링크 나열)를 제거하고 기사 본문에 가까운 부분만 반환.
 * 링크 비율이 높으면 fallback(메타 설명 등)을 우선 사용.
 */
function cleanArticleContent(
  raw: string,
  fallback: string,
  maxLen: number
): string {
  if (!raw || typeof raw !== 'string') return fallback.trim().slice(0, maxLen) || ''
  const normalizedFallback = normalizeText(fallback).trim()

  const lines = raw
    .replace(/\r\n/g, '\n')
    .split(/\n|\s+-\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  const contentLines = lines.filter((l) => !isLinkOnlyLine(l))
  let cleaned = normalizeText(contentLines.join('\n')).trim()

  const linkCount = (cleaned.match(/\]\s*\(\s*https?:\/\/[^\s)]+/gi) ?? []).length
  const linkChars = (cleaned.match(/\]\s*\(\s*[^)]+\)/g) ?? []).join('').length
  const linkDensity = cleaned.length > 0 ? linkChars / cleaned.length : 0

  if (linkDensity > 0.35 || (cleaned.length < 120 && normalizedFallback.length >= 50)) {
    cleaned = normalizedFallback
  }

  return (cleaned || normalizedFallback).slice(0, maxLen)
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
  let userFirecrawl: string | null = null
  if (user?.id) {
    const { data: row } = await supabase
      .from('user_settings')
      .select('gemini_api_key, firecrawl_api_key')
      .eq('user_id', user.id)
      .maybeSingle()
    userGemini = row?.gemini_api_key ?? null
    userFirecrawl = row?.firecrawl_api_key ?? null
  }
  const effective = getEffectiveLicenseKeys(userGemini, userFirecrawl)
  const apiKey = effective.gemini
  const firecrawlApiKey = effective.firecrawl
  if (!effective.canSearch) {
    return new Response(
      JSON.stringify({
        error: '라이선스 키가 필요합니다.',
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
        const rawItems = (searchData.data ?? []).slice(0, 10)
        await trackUsage('firecrawl')
        const MAX_CONTENT_LENGTH = 3500
        const collectedAt = new Date().toISOString()
        const news = rawItems.map((d) => {
          const title =
            d.metadata?.title ?? d.metadata?.description ?? (d as { description?: string }).description ?? (d as { snippet?: string }).snippet ?? '제목 없음'
          const rawContent = d.markdown ?? d.content ?? ''
          const fallback =
            d.metadata?.description ?? (d as { description?: string }).description ?? (d as { snippet?: string }).snippet ?? ''
          const content = cleanArticleContent(rawContent, fallback, MAX_CONTENT_LENGTH)
          const url = typeof d.url === 'string' ? d.url : ''
          let publisher = ''
          try {
            if (url) publisher = new URL(url).hostname.replace(/^www\./, '')
          } catch {
            /* ignore */
          }
          return {
            title: normalizeText(title).slice(0, 200),
            url,
            content: content.length > 0 ? content : undefined,
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

        const sourceTexts = rawItems
          .map((d) => buildSourceSummary(d, MAX_CHARS_PER_SOURCE))
          .filter((s) => s.length > 0)
        const context = sourceTexts.length > 0 ? sourceTexts.join('\n\n') : '데이터 없음'
        const prompt = USER_PROMPT_PREFIX + context + USER_PROMPT_SUFFIX

        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: { maxOutputTokens: 3500 },
        })

        const maxRetries = 3
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
          ? parsed.articleSummaries.filter((s): s is string => typeof s === 'string').slice(0, rawItems.length)
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
