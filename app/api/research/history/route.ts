import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCacheValid, RESEARCH_CACHE_TTL_MS } from '@/lib/research-cache'

/** Authoritative analysis status. UI renders ONLY from this; no inference from partial data. */
export type AnalysisStatus = 'queued' | 'analyzing' | 'completed' | 'failed'

type HistoryRow = {
  report_id: string | null
  analysis_status?: string | null
  analysis_target?: string | null
  confidence_score?: number | null
  market_temperature_score?: number | null
  summary_insights?: string | null
  key_metrics: unknown
  analysis_groq: unknown
  analysis_gemini: unknown
  analysis_results: unknown
  updated_at: string
}

/** GET: no params → list of research_history for current user. ?keyword=xxx&country=KR → single cached report. */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ cached: false, list: [] }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const keyword = searchParams.get('keyword')?.trim()
    const countryRaw = searchParams.get('country')?.trim() || 'KR'
    const country = countryRaw.length === 2 ? countryRaw.toUpperCase() : countryRaw

    if (!keyword) {
      const limit = Math.min(500, Math.max(10, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
      const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

      const { data: rows, error } = await supabase
        .from('research_history')
        .select('id, keyword, country_code, report_id, analysis_status, analysis_target, market_temperature_score, summary_insights, key_metrics, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('[Research History] list:', error)
        return NextResponse.json({ list: [], error: error.message }, { status: 500 })
      }
      const list = (rows ?? []).map((r) => {
        const km = (r as { key_metrics?: { opportunity_score?: number; negative_risks?: string[]; decision_risks?: string[]; pm_actions?: { recommended_actions?: Array<{ title?: string; urgency_level?: string }> } } }).key_metrics
        const topRisk = Array.isArray(km?.negative_risks) && km.negative_risks.length > 0
          ? km.negative_risks[0]
          : Array.isArray(km?.decision_risks) && km.decision_risks.length > 0
            ? km.decision_risks[0]
            : null
        const recs = km?.pm_actions?.recommended_actions ?? []
        const topAction = recs.find((a) => typeof a === 'object' && (a as { urgency_level?: string }).urgency_level === 'high')
          ?? recs.find((a) => typeof a === 'object' && (a as { urgency_level?: string }).urgency_level === 'medium')
          ?? recs.find((a) => typeof a === 'object' && (a as { title?: string }).title)
        const topActionLine = typeof topAction === 'object' && topAction != null && typeof (topAction as { title?: string }).title === 'string'
          ? (topAction as { title: string }).title
          : null
        const opportunityScore = typeof km?.opportunity_score === 'number' ? km.opportunity_score : null
        return {
          id: r.id,
          keyword: r.keyword ?? '',
          country_code: r.country_code ?? 'KR',
          report_id: r.report_id ?? null,
          analysis_status: ensureAnalysisStatus((r as { analysis_status?: string }).analysis_status),
          analysis_target: (r as { analysis_target?: string }).analysis_target ?? null,
          market_temperature_score: typeof (r as { market_temperature_score?: number }).market_temperature_score === 'number'
            ? (r as { market_temperature_score: number }).market_temperature_score
            : null,
          opportunity_score: opportunityScore,
          summary_insights: (r as { summary_insights?: string }).summary_insights ?? null,
          top_risk: topRisk,
          top_action: topActionLine,
          updated_at: r.updated_at ?? null,
          date: r.updated_at ? new Date(r.updated_at).toLocaleDateString('ko-KR') : '',
        }
      })
      const { count } = await supabase
        .from('research_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      return NextResponse.json({ list, total: count ?? list.length })
    }

    const selectCols = 'report_id, analysis_status, analysis_target, confidence_score, market_temperature_score, summary_insights, key_metrics, analysis_groq, analysis_gemini, analysis_results, updated_at'
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

    const basePayload = {
      cached: true,
      cacheExpired,
      reportId: row.report_id ?? report?.id,
      keyword,
      analysis_status: ensureAnalysisStatus(row.analysis_status),
      analysis_target: row.analysis_target ?? undefined,
      confidence_score: typeof row.confidence_score === 'number' ? row.confidence_score : undefined,
      market_temperature_score: typeof row.market_temperature_score === 'number' ? row.market_temperature_score : undefined,
      summary_insights: typeof row.summary_insights === 'string' ? row.summary_insights : undefined,
      updated_at: row.updated_at,
      analysis_groq: ensureTabAnalysisRecord(row.analysis_groq) ?? undefined,
      analysis_gemini: ensureTabAnalysisRecord(row.analysis_gemini) ?? undefined,
      analysis_results: ensureObject(row.analysis_results),
      key_metrics: ensureObject(row.key_metrics),
    }
    if (reportError || !report) {
      return NextResponse.json({
        ...basePayload,
        content: {},
        source_links: [],
        ai_responses: {},
      })
    }

    const content = (report.content ?? {}) as Record<string, unknown>
    return NextResponse.json({
      ...basePayload,
      reportId: report.id,
      content,
      source_links: (report as { source_links?: unknown }).source_links ?? [],
      ai_responses: (report as { ai_responses?: Record<string, string> }).ai_responses ?? {},
    })
  } catch (e) {
    console.error('[Research History] GET:', e)
    return NextResponse.json({ cached: false }, { status: 500 })
  }
}

/** DELETE body: { id?: string, ids?: string[] } — delete research_history row(s) for current user. */
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({})) as { id?: string; ids?: string[] }
    const ids: string[] = Array.isArray(body?.ids)
      ? body.ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : typeof body?.id === 'string' && body.id.trim()
        ? [body.id.trim()]
        : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'id or ids required' }, { status: 400 })
    }
    const { error } = await supabase
      .from('research_history')
      .delete()
      .eq('user_id', user.id)
      .in('id', ids)

    if (error) {
      console.error('[Research History] DELETE:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return new Response(null, { status: 204 })
  } catch (e) {
    console.error('[Research History] DELETE:', e)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}

/** Normalize analysis_status; fallback for legacy rows without column. */
function ensureAnalysisStatus(value: unknown): AnalysisStatus {
  const s = typeof value === 'string' ? value : ''
  if (s === 'queued' || s === 'analyzing' || s === 'completed' || s === 'failed') return s
  return 'completed'
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
