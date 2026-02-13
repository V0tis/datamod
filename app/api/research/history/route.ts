import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET ?keyword=xxx&country=KR → 단일 캐시 조회 (기존)
 * GET (no params) → 사용자 최근 research_history 목록 (리스트용)
 */
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
    const countryCode = searchParams.get('country')?.trim() || 'KR'

    if (!keyword) {
      const { data: rows, error } = await supabase
        .from('research_history')
        .select('id, keyword, country_code, report_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('[Research History] list error:', error)
        return NextResponse.json(
          { error: '기록을 불러오지 못했습니다.' },
          { status: 500 }
        )
      }

      const list = (rows ?? []).map((r) => ({
        id: r.id,
        keyword: r.keyword,
        country_code: r.country_code ?? 'KR',
        report_id: r.report_id ?? null,
        updated_at: r.updated_at ?? null,
        date: (r.updated_at ?? '').slice(0, 10),
      }))
      return NextResponse.json({ list })
    }

    type HistoryRow = {
      id: string
      report_id: string | null
      analysis_market: string | null
      analysis_insight: string | null
      analysis_report: string | null
      key_metrics: unknown
      analysis_groq: unknown
      analysis_gemini: unknown
      analysis_results: unknown
      updated_at: string | null
      created_at: string | null
      reports?: { id: string; keyword: string; content: unknown; source_links: unknown; ai_responses: unknown; user_id?: string } | null
    }
    const { data: row, error } = await supabase
      .from('research_history')
      .select(
        `id, report_id, analysis_market, analysis_insight, analysis_report, key_metrics, analysis_groq, analysis_gemini, analysis_results, updated_at, created_at,
        reports (id, keyword, content, source_links, ai_responses, user_id)`
      )
      .eq('user_id', user.id)
      .eq('keyword', keyword)
      .eq('country_code', countryCode)
      .maybeSingle()

    if (error) {
      console.error('[Research History] select error:', error)
      return NextResponse.json(
        { error: '캐시를 불러오지 못했습니다.' },
        { status: 500 }
      )
    }

    const r = row as HistoryRow | null
    if (!r) {
      return NextResponse.json({ cached: false })
    }

    const hasAnyAnalysis =
      (r.analysis_market && r.analysis_market.trim() !== '') ||
      (r.analysis_insight && r.analysis_insight.trim() !== '') ||
      (r.analysis_report && r.analysis_report.trim() !== '')

    if (!r.report_id) {
      return NextResponse.json({
        cached: true,
        emptyAnalysis: true,
        updated_at: r.updated_at,
      })
    }

    const reportsRow = Array.isArray(r.reports) ? r.reports[0] : r.reports
    const report = reportsRow && (reportsRow.user_id == null || reportsRow.user_id === user.id) ? reportsRow : null

    if (!report) {
      return NextResponse.json({
        cached: true,
        emptyAnalysis: !hasAnyAnalysis,
        reportId: r.report_id,
        analysis_market: r.analysis_market ?? undefined,
        analysis_insight: r.analysis_insight ?? undefined,
        analysis_report: r.analysis_report ?? undefined,
        key_metrics: r.key_metrics ?? undefined,
        analysis_groq: r.analysis_groq ?? undefined,
        analysis_gemini: r.analysis_gemini ?? undefined,
        analysis_results: r.analysis_results ?? undefined,
        updated_at: r.updated_at,
      })
    }

    const content = (report.content ?? {}) as Record<string, unknown>
    const sourceLinks = Array.isArray((report as { source_links?: unknown }).source_links)
      ? (report as { source_links: Array<{ title?: string; url?: string }> }).source_links
      : []
    const aiResponses = (report.ai_responses ?? {}) as Record<string, string>

    return NextResponse.json({
      cached: true,
      emptyAnalysis: !hasAnyAnalysis,
      reportId: report.id,
      keyword: report.keyword,
      content,
      source_links: sourceLinks,
      ai_responses: {
        logic: r.analysis_market ?? aiResponses.logic,
        creative: r.analysis_insight ?? aiResponses.creative,
        fact: r.analysis_report ?? aiResponses.fact,
      },
      key_metrics: r.key_metrics ?? undefined,
      analysis_groq: r.analysis_groq ?? undefined,
      analysis_gemini: r.analysis_gemini ?? undefined,
      analysis_results: r.analysis_results ?? undefined,
      updated_at: r.updated_at,
    })
  } catch (e) {
    console.error('[Research History]', e)
    return NextResponse.json(
      { error: '캐시를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}

/** DELETE: research_history 행 삭제 (본인만). body: { id: string } */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    let body: { id?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 })
    }

    const { data: row, error: fetchError } = await supabase
      .from('research_history')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchError || !row) {
      return NextResponse.json(
        { error: '해당 기록을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { error: deleteError } = await supabase
      .from('research_history')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('[Research History] DELETE error:', deleteError)
      return NextResponse.json(
        { error: '삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Research History] DELETE:', e)
    return NextResponse.json(
      { error: '삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
