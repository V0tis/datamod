/**
 * GET /api/analysis/status?keyword=xxx&country=KR
 * Returns current analysis task status for polling.
 * Used by Result page to track analysis progress.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

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
    const keyword = searchParams.get('keyword')?.trim()
    const country = (searchParams.get('country')?.trim() || 'KR').toUpperCase()

    if (!keyword) {
      return NextResponse.json(
        { error: 'keyword is required' },
        { status: 400 }
      )
    }

    const { data: row, error } = await supabase
      .from('research_history')
      .select('id, analysis_status, progress_step, report_id, key_metrics, serper_used, updated_at')
      .eq('user_id', user.id)
      .eq('keyword', keyword)
      .eq('country_code', country)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[Analysis Status]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!row) {
      return NextResponse.json({
        id: null,
        status: 'pending' as AnalysisStatus,
        progressStep: 0,
        result: null,
      })
    }

    const status = (row.analysis_status === 'queued' || row.analysis_status === 'analyzing'
      ? 'running'
      : row.analysis_status === 'completed'
        ? 'completed'
        : row.analysis_status === 'failed'
          ? 'failed'
          : 'pending') as AnalysisStatus

    const progressStep = typeof row.progress_step === 'number' ? row.progress_step : 0

    if (status === 'completed' && row.report_id) {
      const { data: report } = await supabase
        .from('reports')
        .select('id, content, source_links')
        .eq('id', row.report_id)
        .maybeSingle()

      const km = (row.key_metrics ?? {}) as Record<string, unknown>
      const result = {
        reportId: row.report_id,
        key_metrics: km,
        content: (report?.content ?? {}) as Record<string, unknown>,
        source_links: (report as { source_links?: unknown })?.source_links ?? [],
        updated_at: row.updated_at,
        serper_used: (row as { serper_used?: boolean }).serper_used === true,
      }

      return NextResponse.json({
        id: row.id,
        status,
        progressStep: 5,
        result,
      })
    }

    return NextResponse.json({
      id: row.id,
      status,
      progressStep,
      result: null,
    })
  } catch (e) {
    console.error('[Analysis Status]', e)
    return NextResponse.json(
      { error: '분석 상태를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
