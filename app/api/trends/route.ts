import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { refreshGlobalTrends, isTrendsStale, type TrendItem } from '@/lib/trends-cache'

const COUNTRY_CODES = ['KR', 'US', 'JP'] as const
const isDev = process.env.NODE_ENV === 'development'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

type TrendRow = {
  country_code: string
  keyword: string
  rank: number
  search_volume: string | null
  started_at: string | null
  analysis_keywords: string[] | null
  created_at: string | null
}

function formatErrorPayload(err: unknown): Record<string, unknown> {
  const summary = { error: '트렌드 데이터를 불러오지 못했습니다.' }
  if (!isDev) return summary
  if (err instanceof Error) {
    return {
      ...summary,
      message: err.message,
      hint: (err as Error & { hint?: string }).hint,
      details: (err as Error & { details?: string }).details,
    }
  }
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>
    return {
      ...summary,
      message: o.message,
      hint: o.hint,
      details: o.details,
    }
  }
  return { ...summary, message: String(err) }
}

function rowToItem(r: TrendRow): TrendItem {
  return {
    keyword: r.keyword,
    rank: r.rank,
    search_volume: r.search_volume ?? null,
    started_at: r.started_at ?? null,
    analysis_keywords: Array.isArray(r.analysis_keywords) ? r.analysis_keywords : [],
  }
}

function buildResponse(rows: TrendRow[]): { KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[]; updatedAt: string | null } {
  const map: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  let latestAt: string | null = null
  for (const row of rows) {
    const code = row.country_code
    if (COUNTRY_CODES.includes(code as (typeof COUNTRY_CODES)[number])) {
      map[code].push(rowToItem(row))
    }
    if (row.created_at) {
      if (!latestAt || row.created_at > latestAt) latestAt = row.created_at
    }
  }
  for (const code of COUNTRY_CODES) {
    map[code].sort((a, b) => a.rank - b.rank)
  }
  return {
    KR: map.KR,
    US: map.US,
    JP: map.JP,
    updatedAt: latestAt,
  }
}

/** GET: 공유 캐시(global_trends) 우선 조회. 없거나 오래됐으면 Firecrawl 갱신 후 반환. */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from('global_trends')
      .select('country_code, keyword, rank, search_volume, started_at, analysis_keywords, created_at')
      .in('country_code', COUNTRY_CODES)
      .order('rank', { ascending: true })

    if (error) {
      if (isDev) console.log('[Dev] Trends GET Supabase error:', error, new Error().stack)
      console.error('[Trends GET]', error)
      return NextResponse.json(formatErrorPayload(error), {
        status: 500,
        headers: JSON_HEADERS,
      })
    }

    const needRefresh = isTrendsStale(rows ?? [], [...COUNTRY_CODES])
    if (needRefresh && process.env.FIRECRAWL_API_KEY?.trim()) {
      await refreshGlobalTrends()
      const { data: fresh, error: freshError } = await supabase
        .from('global_trends')
        .select('country_code, keyword, rank, search_volume, started_at, analysis_keywords, created_at')
        .in('country_code', COUNTRY_CODES)
        .order('rank', { ascending: true })
      if (freshError) {
        if (isDev) console.log('[Dev] Trends GET fresh after refresh error:', freshError, new Error().stack)
        console.error('[Trends GET] fresh after refresh', freshError)
        return NextResponse.json(formatErrorPayload(freshError), {
          status: 500,
          headers: JSON_HEADERS,
        })
      }
      return NextResponse.json(buildResponse(fresh ?? []), { headers: JSON_HEADERS })
    }

    return NextResponse.json(buildResponse(rows ?? []), { headers: JSON_HEADERS })
  } catch (err) {
    if (isDev) console.log('[Dev] Trends GET exception:', err, err instanceof Error ? err.stack : '')
    console.error('[Trends GET]', err)
    return NextResponse.json(formatErrorPayload(err), {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
