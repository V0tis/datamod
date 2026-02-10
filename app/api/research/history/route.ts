import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET ?keyword=xxx&country=KR
 * research_history + reports 조인하여 캐시된 분석 반환.
 * - 있으면: reportId, content, source_links, analysis_market, analysis_insight, analysis_report, key_metrics, updated_at
 * - 기록은 있지만 분석 텍스트가 모두 비어있으면: emptyAnalysis: true (최초 1회 분석 실행 유도)
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
      return NextResponse.json({ error: 'keyword required' }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from('research_history')
      .select(
        'id, report_id, analysis_market, analysis_insight, analysis_report, key_metrics, analysis_groq, analysis_hf, updated_at, created_at'
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

    if (!row) {
      return NextResponse.json({ cached: false })
    }

    const hasAnyAnalysis =
      (row.analysis_market && row.analysis_market.trim() !== '') ||
      (row.analysis_insight && row.analysis_insight.trim() !== '') ||
      (row.analysis_report && row.analysis_report.trim() !== '')

    if (!row.report_id) {
      return NextResponse.json({
        cached: true,
        emptyAnalysis: true,
        updated_at: row.updated_at,
      })
    }

    const { data: report } = await supabase
      .from('reports')
      .select('id, keyword, content, source_links, ai_responses')
      .eq('id', row.report_id)
      .eq('user_id', user.id)
      .single()

    if (!report) {
      return NextResponse.json({
        cached: true,
        emptyAnalysis: !hasAnyAnalysis,
        reportId: row.report_id,
        analysis_market: row.analysis_market ?? undefined,
        analysis_insight: row.analysis_insight ?? undefined,
        analysis_report: row.analysis_report ?? undefined,
        key_metrics: row.key_metrics ?? undefined,
        analysis_groq: row.analysis_groq ?? undefined,
        analysis_hf: row.analysis_hf ?? undefined,
        updated_at: row.updated_at,
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
        logic: row.analysis_market ?? aiResponses.logic,
        creative: row.analysis_insight ?? aiResponses.creative,
        fact: row.analysis_report ?? aiResponses.fact,
      },
      key_metrics: row.key_metrics ?? undefined,
      analysis_groq: row.analysis_groq ?? undefined,
      analysis_hf: row.analysis_hf ?? undefined,
      updated_at: row.updated_at,
    })
  } catch (e) {
    console.error('[Research History]', e)
    return NextResponse.json(
      { error: '캐시를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
