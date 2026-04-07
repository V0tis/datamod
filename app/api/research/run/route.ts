/**
 * POST /api/research/run
 * Single entry point for research execution with NDJSON streaming.
 * Replaces job-based polling with direct streaming response.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiKeyForRequest, getGroqKeyForRequest, getSerperKeyForRequest, getStepAISettingsForRequest } from '@/lib/research-keys'
import { runResearch, type ResearchStreamEvent } from '@/lib/ai'
import { logger } from '@/lib/logger'

import { RESEARCH_RUN_DEADLINE_MS } from '@/lib/api/route-timeouts'

/** Mark research_history as failed so "Recent analysis" does not show analyzing forever. */
async function markResearchFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  keyword: string,
  countryCode: string,
  errorMessage: string
) {
  try {
    await supabase
      .from('research_history')
      .update({
        analysis_status: 'failed',
        error_message: errorMessage.slice(0, 500),
        progress_step: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('keyword', keyword)
      .eq('country_code', countryCode)
  } catch (e) {
    logger.error('markResearchFailed', { userId: userId.slice(0, 8), keyword, error: e instanceof Error ? e.message : String(e) })
  }
}

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
      ai_primary_model?: string
      force_reanalyze?: boolean
      /** 2: 인사이트부터, 3: 전략·실행부터 (저장된 태스크 필요) */
      rerun_from_phase?: number
    }
    const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
    const countryCode =
      typeof body?.country_code === 'string' ? body.country_code.trim() || 'KR' : 'KR'
    let modeRaw = body?.mode
    if (modeRaw === undefined || modeRaw === null || modeRaw === '') {
      const { data: settingsRow } = await supabase
        .from('user_settings')
        .select('analysis_depth')
        .eq('user_id', user.id)
        .maybeSingle()
      const saved = (settingsRow as { analysis_depth?: string } | null)?.analysis_depth
      modeRaw = saved === 'fast' || saved === 'deep' ? saved : 'standard'
    }
    const mode = modeRaw === 'fast' ? 'quick' : ['quick', 'standard', 'deep'].includes(String(modeRaw))
      ? (modeRaw as 'quick' | 'standard' | 'deep')
      : 'standard'
    const forceReanalyze = body?.force_reanalyze === true
    const rawPhase = body?.rerun_from_phase
    const rerunFromPhase =
      rawPhase === 1 || rawPhase === 2 || rawPhase === 3 ? (rawPhase as 1 | 2 | 3) : undefined

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

    const bodyPrimaryModel = body.ai_primary_model === 'groq' || body.ai_primary_model === 'gemini'
      ? body.ai_primary_model
      : null
    const [geminiResult, groqKey, serperKey, stepAISettings] = await Promise.all([
      getGeminiKeyForRequest(supabase, user.id),
      getGroqKeyForRequest(supabase, user.id),
      getSerperKeyForRequest(supabase, user.id),
      getStepAISettingsForRequest(supabase, user.id),
    ])
    const primaryProvider = bodyPrimaryModel ?? stepAISettings.ai_primary_model
    if (bodyPrimaryModel) stepAISettings.ai_primary_model = bodyPrimaryModel
    const { gemini, canSearch } = geminiResult
    const hasGemini = !!(gemini && gemini.length > 0)
    const hasGroq = !!(groqKey && groqKey.length > 0)

    logger.info('AI analysis: provider selection', {
      userId: user.id.slice(0, 8) + '...',
      primaryProvider,
      canSearch,
      hasGemini,
      hasGroq,
      runtime: 'nodejs',
    })

    if (primaryProvider === 'groq') {
      if (!hasGroq) {
        return NextResponse.json(
          { error: 'AI 우선 분석을 Groq로 설정한 경우 Groq API 키(설정 또는 서버 환경 변수)가 필요합니다.' },
          { status: 400 }
        )
      }
    } else {
      if (!hasGemini || !canSearch) {
        return NextResponse.json(
          { error: '설정에서 Gemini API 키를 등록한 뒤 분석을 사용할 수 있습니다.' },
          { status: 400 }
        )
      }
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
        let hadTerminalEvent = false

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
            if (event.type === 'error' || event.type === 'done' || event.type === 'cached') {
              hadTerminalEvent = true
            }
          } catch {
            isClosed = true
            safeClose()
          }
        }

        combinedController.signal.addEventListener('abort', () => {
          if (isClosed) return
          void markResearchFailed(
            supabase,
            user.id,
            keyword,
            countryCode,
            '분석이 중단되었거나 시간이 초과되었습니다.'
          )
          try {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  type: 'error',
                  message: '분석이 중단되었거나 시간이 초과되었습니다.',
                }) + '\n'
              )
            )
            hadTerminalEvent = true
          } catch {
            /* client may have disconnected */
          }
          isClosed = true
          safeClose()
        })

        try {
          const generator = runResearch({
            supabase,
            keyword,
            countryCode,
            userId: user.id,
            geminiKey: gemini,
            groqKey,
            serperKey,
            primaryProvider,
            stepAISettings,
            mode,
            signal: combinedController.signal,
            forceReanalyze,
            rerunFromPhase,
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

            if (event.type === 'error') {
              const msg = 'message' in event ? String(event.message) : '분석 중 오류가 발생했습니다.'
              await markResearchFailed(supabase, user.id, keyword, countryCode, msg)
              break
            }
            if (event.type === 'done' || event.type === 'cached') {
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
          await markResearchFailed(supabase, user.id, keyword, countryCode, message)
          send({ type: 'error', message })
        }

        if (!hadTerminalEvent && !isClosed) {
          await markResearchFailed(
            supabase,
            user.id,
            keyword,
            countryCode,
            '분석이 완료되지 않고 연결이 종료되었습니다.'
          )
          send({
            type: 'error',
            message: '분석이 완료되지 않고 연결이 종료되었습니다.',
          })
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
