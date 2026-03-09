/**
 * POST /api/research/run
 * Single entry point for research execution with NDJSON streaming.
 * Replaces job-based polling with direct streaming response.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getGeminiKeyForRequest, getGroqKeyForRequest, getAIPrimaryModelForRequest } from '@/lib/research-keys'
import { runResearch, type ResearchStreamEvent } from '@/lib/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Vercel: analysis takes 1-3 min; default 10s would timeout. Hobby max 300s. */
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

    console.log('[Research Run API] POST 요청', { keyword, countryCode, userId: user.id })

    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (e) {
      console.error('[Research Run API] createAdminClient failed:', e)
      return NextResponse.json(
        { error: '서버 설정 오류: Supabase 환경 변수를 확인해 주세요. (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)' },
        { status: 500 }
      )
    }
    const [geminiResult, groqKey, primaryProvider] = await Promise.all([
      getGeminiKeyForRequest(adminClient, user.id),
      getGroqKeyForRequest(adminClient, user.id),
      getAIPrimaryModelForRequest(adminClient, user.id),
    ])
    const { gemini, canSearch } = geminiResult
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

    const abortSignal = req.signal
    const encoder = new TextEncoder()

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

        if (abortSignal) {
          abortSignal.addEventListener('abort', () => {
            isClosed = true
            safeClose()
          })
        }

        try {
          const generator = runResearch({
            keyword,
            countryCode,
            userId: user.id,
            geminiKey: gemini,
            groqKey,
            primaryProvider,
            mode,
          })

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
        } catch (err) {
          const message =
            err instanceof Error ? err.message : '분석 중 오류가 발생했습니다.'
          console.log('[Research Run API] 제너레이터 예외', { keyword, error: message, err })
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
    console.log('[Research Run API] POST 예외:', e)
    return NextResponse.json(
      { error: '분석을 시작하지 못했어요. 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
