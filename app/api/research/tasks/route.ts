/**
 * GET /api/research/tasks
 * Poll analysis task status by analysis_id.
 * Returns steps with status: pending | running | completed | failed
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STEP_ORDER = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
] as const

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const analysisId = searchParams.get('analysis_id')
    if (!analysisId || typeof analysisId !== 'string') {
      return NextResponse.json(
        { error: 'analysis_id 쿼리 파라미터가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!analysisId.startsWith(user.id + '|')) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[research/tasks] GET 폴링', { analysisId: analysisId.slice(0, 50) + '...' })
    }

    const { data: rows, error } = await supabase
      .from('analysis_tasks')
      .select('step_name, status, output_data, error_message, started_at, completed_at, provider, fallback_used, primary_provider_error')
      .eq('analysis_id', analysisId)
      .in('step_name', STEP_ORDER)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[research/tasks] DB 에러', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      /** 500 대신 200 + fetch_error: 콘솔 Failed to load resource 완화, 클라이언트에서 1회 토스트 가능 */
      const tasks = STEP_ORDER.map((step) => ({
        step_name: step,
        status: 'pending' as const,
        output_data: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        provider: null,
        fallback_used: false,
        primary_provider_error: null,
      }))
      return NextResponse.json({
        analysis_id: analysisId,
        tasks,
        all_completed: false,
        any_failed: false,
        running_step: null,
        fetch_error: true,
      })
    }

    const byStep = new Map(
      (rows ?? []).map((r) => [
        r.step_name,
        {
          step_name: r.step_name,
          status: r.status as 'pending' | 'running' | 'completed' | 'failed',
          output_data: r.output_data,
          error_message: r.error_message,
          started_at: r.started_at,
          completed_at: r.completed_at,
          provider: (r as { provider?: string | null }).provider ?? null,
          fallback_used: (r as { fallback_used?: boolean }).fallback_used ?? false,
          primary_provider_error: (r as { primary_provider_error?: string | null }).primary_provider_error ?? null,
        },
      ])
    )

    const tasks = STEP_ORDER.map((step) => {
      const row = byStep.get(step)
      return row ?? { step_name: step, status: 'pending' as const, output_data: null, error_message: null, started_at: null, completed_at: null, provider: null, fallback_used: false, primary_provider_error: null }
    })

    const allCompleted = tasks.every((t) => t.status === 'completed')
    const anyFailed = tasks.some((t) => t.status === 'failed')
    const runningStep = tasks.find((t) => t.status === 'running')

    const failedTask = tasks.find((t) => t.status === 'failed')
    if (failedTask) {
      console.log('[research/tasks] 실패한 태스크', {
        step: failedTask.step_name,
        error_message: failedTask.error_message,
        analysisId: analysisId.slice(0, 50) + '...',
      })
    }

    return NextResponse.json({
      analysis_id: analysisId,
      tasks,
      all_completed: allCompleted,
      any_failed: anyFailed,
      running_step: runningStep?.step_name ?? null,
    })
  } catch (e) {
    console.log('[research/tasks] 예외', e)
    return NextResponse.json(
      { error: '태스크 상태를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
