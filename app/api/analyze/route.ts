/**
 * Edge-based NDJSON streaming analysis API.
 * POST /api/analyze — streams newline-delimited JSON events.
 * Each line: {"type":"summary|temperature|insight|action","content":"..."}
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGeminiKeyForRequest } from '@/lib/research-keys'
import { generateTextStream } from '@/services/ai/geminiClient'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { fetchNewsTitlesEdge } from '@/lib/research-news-edge'
import {
  NDJSON_ANALYSIS_SYSTEM,
  buildNdjsonAnalysisPrompt,
} from '@/lib/ai/ndjson-analysis-prompt'
import { buildCacheKeyParts } from '@/lib/research-cache'
import { trackUsage } from '@/lib/usage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_OUTPUT_TOKENS = 700

type NdjsonEvent = { type: string; content?: string }

function parseActionContent(content: string): { title: string; reasoning: string; urgency: 'low' | 'medium' | 'high' } {
  const parts = (content ?? '').split('|').map((p) => p.trim())
  const title = parts[0] ?? ''
  const reasoning = parts[1] ?? ''
  const urg = (parts[2] ?? 'low').toLowerCase()
  const urgency = urg === 'high' || urg === 'medium' ? urg : 'low'
  return { title, reasoning, urgency }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { keyword?: string; country_code?: string }
    const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
    const countryCode = typeof body?.country_code === 'string' ? body.country_code.trim() || 'KR' : 'KR'
    if (!keyword) {
      return NextResponse.json({ error: '검색어(keyword)가 필요합니다.' }, { status: 400 })
    }

    const { gemini, canSearch } = await getGeminiKeyForRequest(
      createAdminClient(),
      user.id
    )
    if (!canSearch || !gemini) {
      return NextResponse.json({
        error: '설정에서 API 키를 등록한 뒤 분석을 사용할 수 있습니다.',
      }, { status: 400 })
    }

    const news = await fetchNewsTitlesEdge(keyword)
    const newsTitles = news.map((n) => n.title)
    const prompt = buildNdjsonAnalysisPrompt(keyword, newsTitles)

    let buffer = ''
    let summary = ''
    let temperature = 50
    const insights: string[] = []
    const actions: Array<{ title: string; reasoning: string; urgency: 'low' | 'medium' | 'high' }> = []

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of generateTextStream({
            apiKey: gemini,
            prompt,
            systemInstruction: NDJSON_ANALYSIS_SYSTEM,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            model: GEMINI_MODEL,
          })) {
            buffer += chunk
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                const event = JSON.parse(trimmed) as NdjsonEvent
                const type = String(event.type ?? '').toLowerCase()
                const content = typeof event.content === 'string' ? event.content : ''
                if (type === 'summary') {
                  summary = content
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'summary', content }) + '\n'))
                } else if (type === 'temperature') {
                  const n = parseInt(content, 10)
                  if (!isNaN(n)) {
                    temperature = Math.min(100, Math.max(0, n))
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'temperature', content: String(temperature) }) + '\n'))
                  }
                } else if (type === 'insight' && content) {
                  insights.push(content)
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'insight', content }) + '\n'))
                } else if (type === 'action' && content) {
                  const a = parseActionContent(content)
                  if (a.title) {
                    actions.push(a)
                    controller.enqueue(encoder.encode(JSON.stringify({ type: 'action', content }) + '\n'))
                  }
                }
              } catch {
                /* skip invalid JSON line */
              }
            }
          }
          if (buffer.trim()) {
            try {
              const event = JSON.parse(buffer.trim()) as NdjsonEvent
              const type = String(event.type ?? '').toLowerCase()
              const content = typeof event.content === 'string' ? event.content : ''
              if (type === 'summary') {
                summary = content
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'summary', content }) + '\n'))
              } else if (type === 'temperature') {
                const n = parseInt(content, 10)
                if (!isNaN(n)) {
                  temperature = Math.min(100, Math.max(0, n))
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'temperature', content: String(temperature) }) + '\n'))
                }
              } else if (type === 'insight' && content) {
                insights.push(content)
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'insight', content }) + '\n'))
              } else if (type === 'action' && content) {
                const a = parseActionContent(content)
                if (a.title) {
                  actions.push(a)
                  controller.enqueue(encoder.encode(JSON.stringify({ type: 'action', content }) + '\n'))
                }
              }
            } catch {
              /* skip */
            }
          }

          await trackUsage('gemini')

          const keyConclusions = insights.length ? insights.slice(0, 5) : (summary ? [summary] : [])
          const keyMetrics = {
            chartData: { sentiment: { positive: 65, neutral: 20, negative: 15 }, impact: [] as never[] },
            keyConclusions,
            sentiment: temperature,
            market_temperature_score: temperature,
            summary_insights: summary,
            facts: insights.slice(0, 5),
            hypotheses: undefined as string[] | undefined,
            inferences: undefined as string[] | undefined,
            positive_signals: [] as string[],
            neutral_signals: [] as string[],
            negative_risks: [] as string[],
            pm_actions: {
              recommended_actions: actions.map((a) => ({
                title: a.title,
                reasoning: a.reasoning,
                urgency_level: a.urgency,
              })),
              monitoring_points: [] as string[],
              decision_risks: [] as string[],
            },
          }

          const summaryContent = {
            marketNews: keyConclusions.slice(0, 5),
            painPoints: [] as string[],
            competitorTrends: '',
            sentiment: temperature,
            publicReactionTrends: summary,
            chartData: keyMetrics.chartData,
            articleSummaries: news.map(() => ''),
            keyConclusions,
          }

          const admin = createAdminClient()
          const cacheKey = buildCacheKeyParts(user.id, keyword, countryCode)
          const { data: report, error: insertErr } = await admin
            .from('reports')
            .insert({
              user_id: user.id,
              keyword,
              content: summaryContent,
              source_links: news,
              ai_responses: {},
            })
            .select('id')
            .single()

          let reportId: string | null = null
          if (!insertErr && report?.id) {
            reportId = report.id
            await admin.from('research_history').upsert(
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

          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'done',
            reportId,
            source_links: news,
          }) + '\n'))
        } catch (err) {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: 'error',
            error: (err as Error).message,
          }) + '\n'))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store',
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: '분석을 시작하지 못했어요. 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
