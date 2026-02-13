import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET ?keyword=xxx&country=KR → research_history + report 캐시 반환 (analysis_results, key_metrics, analysis_groq, analysis_gemini 포함) */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ cached: false }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const keyword = searchParams.get('keyword')?.trim()
    const country = searchParams.get('country')?.trim() || 'KR'

    if (!keyword) {
      return NextResponse.json({ cached: false })
    }

    const { data: history, error: historyError } = await supabase
      .from('research_history')
      .select('report_id, key_metrics, analysis_groq, analysis_gemini, analysis_results, updated_at')
      .eq('user_id', user.id)
      .eq('keyword', keyword)
      .eq('country_code', country)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (historyError || !history?.report_id) {
      return NextResponse.json({ cached: false })
    }

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, content, source_links, ai_responses')
      .eq('id', history.report_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (reportError || !report) {
      return NextResponse.json({
        cached: true,
        reportId: history.report_id,
        keyword,
        content: {},
        source_links: [],
        ai_responses: {},
        updated_at: history.updated_at,
        analysis_groq: history.analysis_groq ?? undefined,
        analysis_gemini: history.analysis_gemini ?? undefined,
        analysis_results: ensureObject(history.analysis_results),
        key_metrics: ensureObject(history.key_metrics),
      })
    }

    const content = (report.content ?? {}) as Record<string, unknown>
    return NextResponse.json({
      cached: true,
      reportId: report.id,
      keyword: report.keyword,
      content,
      source_links: (report as { source_links?: unknown }).source_links ?? [],
      ai_responses: (report as { ai_responses?: Record<string, string> }).ai_responses ?? {},
      updated_at: history.updated_at,
      analysis_groq: history.analysis_groq ?? undefined,
      analysis_gemini: history.analysis_gemini ?? undefined,
      analysis_results: ensureObject(history.analysis_results),
      key_metrics: ensureObject(history.key_metrics),
    })
  } catch (e) {
    console.error('[Research History] GET:', e)
    return NextResponse.json({ cached: false }, { status: 500 })
  }
}

function ensureObject(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown
      return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : undefined
    } catch {
      return undefined
    }
  }
  return undefined
}
