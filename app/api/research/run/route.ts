/**
 * POST /api/research/run
 * Single entry point for research execution with NDJSON streaming.
 * Replaces job-based polling with direct streaming response.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiKeyForRequest, getGroqKeyForRequest, getAIPrimaryModelForRequest } from '@/lib/research-keys'
import { runResearch, type ResearchStreamEvent } from '@/lib/ai'
import { logger } from '@/lib/logger'

import { RESEARCH_RUN_DEADLINE_MS } from '@/lib/api/route-timeouts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }
    if (!user.email_confirmed_at) {
      return NextResponse.json(
        { error: '이메일 인증을 완료한 후 분석을 이용할 수 있습니다.' },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      keyword?: string
      country_code?: string
      mode?: string
    }
    const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
    const countryCode =
      typeof body?.country_code === 'string' ? body.country_code.trim() || 'KR' : 'KR'
    const mode = ['quick', 'standard', 'deep'].includes(body?.mode ?? '')
      ? (body.mode as 'quick' | 'standard' | 'deep')
      : 'standard'

    if (!keyword) {
      return NextResponse.json(
        { error: '검색어(keyword)가 필요합니다.' },
        { status: 400 }
      )
    }

    const startMs = Date.now()
    const hasCookies = !!req.headers.get('cookie')
    logger.info('AI analysis request', {
      route: '/api/research/run',
      keyword,
      countryCode,
      mode,
      userId: user.id.slice(0, 8) + '...',
      hasCookies,
      runtime: 'nodejs',
    })

    const [geminiResult, groqKey, primaryProvider] = await Promise.all([
      getGeminiKeyForRequest(supabase, user.id),
      getGroqKeyForRequest(supabase, user.id),
      getAIPrimaryModelForRequest(supabase, user.id),
    ])
    const { gemini, canSearch } = geminiResult

    if (process.env.NODE_ENV === 'production' || process.env.DEBUG_KEYS === '1') {
      logger.info('AI analysis: key resolution', {
        userId: user.id.slice(0, 8) + '...',
        canSearch,
        hasGemini: !!gemini && gemini.length > 0,
        primaryProvider,
        runtime: 'nodejs',
      })
    }

    if (!canSearch || !gemini) {
      return NextResponse.json(
        { error: '설정에서 Gemini API 키를 등록한 뒤 분석을 사용할 수 있습니다.' },
        { status: 400 }
      )
    }
    if (primaryProvider === 'groq' && !groqKey) {
      return NextResponse.json(
        { error: 'AI 우선 분석을 Groq로 설정한 경우 Groq API 키가 필요합니다.' },
        { status: 400 }
      )
    }

    const encoder = new TextEncoder()
    const deadlineController = new AbortController()
    const deadlineId = setTimeout(() => deadlineController.abort(), RESEARCH_RUN_DEADLINE_MS)
    const combinedController = new AbortController()
    const onAbort = () => {
      combinedController.abort()
      clearTimeout(deadlineId)
    }
    req.signal?.addEventListener('abort', onAbort)
    deadlineController.signal.addEventListener('abort', onAbort)

    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false

        const safeClose = () => {
          if (isClosed) return
          isClosed = true
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        }

        const send = (event: ResearchStreamEvent) => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
          } catch {
            isClosed = true
            safeClose()
          }
        }

        combinedController.signal.addEventListener('abort', () => {
          isClosed = true
          safeClose()
        })

        try {
          const generator = runResearch({
            keyword,
            countryCode,
            userId: user.id,
            geminiKey: gemini,
            groqKey,
            primaryProvider,
            mode,
            signal: combinedController.signal,
          })

          try {
          for await (const event of generator) {
            if (isClosed) break
            if (event.type === 'task') {
              console.log('[Research Run API] 이벤트', { type: event.type, task: event.task, status: event.status, error: event.error })
            } else if (event.type === 'error' || event.type === 'done' || event.type === 'cached') {
              console.log('[Research Run API] 이벤트', { type: event.type, message: 'message' in event ? event.message : undefined })
            }
            send(event)

            if (event.type === 'error' || event.type === 'done' || event.type === 'cached') {
              break
            }
          }
          } finally {
            clearTimeout(deadlineId)
            req.signal?.removeEventListener('abort', onAbort)
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.'
          logger.error('AI analysis: generator exception', {
            keyword,
            elapsedMs: Date.now() - startMs,
            error: message,
            stack: err instanceof Error ? err.stack : undefined,
          })
          send({ type: 'error', message })
        }

        safeClose()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Cache-Control': 'no-cache, no-store',
        Connection: 'keep-alive',
      },
    })
  } catch (e) {
    logger.error('AI analysis: POST exception', {
      route: '/api/research/run',
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    })
    return NextResponse.json(
      { error: '분석을 시작하지 못했어요. 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
