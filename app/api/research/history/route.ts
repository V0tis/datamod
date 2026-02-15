import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCacheValid, RESEARCH_CACHE_TTL_MS } from '@/lib/research-cache'

type HistoryRow = {
  report_id: string | null
  key_metrics: unknown
  analysis_groq: unknown
  analysis_gemini: unknown
  analysis_results: unknown
  updated_at: string
}

/** GET ?keyword=xxx&country=KR → research_history + report. 키워드·국가 일치하는 최신 행(계정 무관) 사용. */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ cached: false }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const keyword = searchParams.get('keyword')?.trim()
    const countryRaw = searchParams.get('country')?.trim() || 'KR'
    const country = countryRaw.length === 2 ? countryRaw.toUpperCase() : countryRaw

    if (!keyword) {
      return NextResponse.json({ cached: false })
    }

    const selectCols = 'report_id, key_metrics, analysis_groq, analysis_gemini, analysis_results, updated_at'
    const baseQuery = () =>
      supabase
        .from('research_history')
        .select(selectCols)
        .eq('keyword', keyword)
        .eq('country_code', country)
        .order('updated_at', { ascending: false })

    // report_id가 있는 행만 사용. 분석 데이터 있는 행 우선, 없으면 최신 행.
    const { data: historyWithAnalysis } = await baseQuery()
      .not('analysis_groq', 'is', null)
      .not('report_id', 'is', null)
      .limit(1)
      .maybeSingle()

    const { data: historyFallback, error: historyError } = await baseQuery()
      .not('report_id', 'is', null)
      .limit(1)
      .maybeSingle()

    const history = (historyWithAnalysis ?? historyFallback) as HistoryRow | null

    if (historyError || !history?.report_id) {
      return NextResponse.json({ cached: false })
    }

    const row = history
    const cacheExpired = !isCacheValid(row.updated_at, RESEARCH_CACHE_TTL_MS)

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, content, source_links, ai_responses')
      .eq('id', row.report_id)
      .maybeSingle()

    if (reportError || !report) {
      return NextResponse.json({
        cached: true,
        cacheExpired,
        reportId: row.report_id,
        keyword,
        content: {},
        source_links: [],
        ai_responses: {},
        updated_at: row.updated_at,
        analysis_groq: ensureTabAnalysisRecord(row.analysis_groq) ?? undefined,
        analysis_gemini: ensureTabAnalysisRecord(row.analysis_gemini) ?? undefined,
        analysis_results: ensureObject(row.analysis_results),
        key_metrics: ensureObject(row.key_metrics),
      })
    }

    const content = (report.content ?? {}) as Record<string, unknown>
    return NextResponse.json({
      cached: true,
      cacheExpired,
      reportId: report.id,
      keyword,
      content,
      source_links: (report as { source_links?: unknown }).source_links ?? [],
      ai_responses: (report as { ai_responses?: Record<string, string> }).ai_responses ?? {},
      updated_at: row.updated_at,
      analysis_groq: ensureTabAnalysisRecord(row.analysis_groq) ?? undefined,
      analysis_gemini: ensureTabAnalysisRecord(row.analysis_gemini) ?? undefined,
      analysis_results: ensureObject(row.analysis_results),
      key_metrics: ensureObject(row.key_metrics),
    })
  } catch (e) {
    console.error('[Research History] GET:', e)
    return NextResponse.json({ cached: false }, { status: 500 })
  }
}

/** Normalize DB JSON/string into a plain object for API response; returns undefined if not an object. */
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

/** research_history.analysis_groq / analysis_gemini: DB가 문자열이거나 객체일 수 있음. logic 키는 제외하고 creative/fact만 반환. */
function ensureTabAnalysisRecord(value: unknown): Record<string, string> | undefined {
  const obj = ensureObject(value) as Record<string, string> | undefined
  if (!obj) return undefined
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'logic') continue
    if (typeof v === 'string' && v.trim().length > 0) out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}
