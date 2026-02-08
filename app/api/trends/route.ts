import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { refreshGlobalTrends, isTrendsStale } from '@/lib/trends-cache'

const COUNTRY_CODES = ['KR', 'US', 'JP'] as const
const isDev = process.env.NODE_ENV === 'development'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const

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

function buildResponse(
  rows: { country_code: string; keywords: unknown; created_at: string | null }[]
): { KR: string[]; US: string[]; JP: string[]; updatedAt: string | null } {
  const map: Record<string, string[]> = { KR: [], US: [], JP: [] }
  let latestAt: string | null = null
  for (const row of rows) {
    const code = row.country_code as string
    const keywords = Array.isArray(row.keywords) ? row.keywords : []
    if (COUNTRY_CODES.includes(code as (typeof COUNTRY_CODES)[number])) {
      map[code] = keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
    }
    if (row.created_at) {
      if (!latestAt || row.created_at > latestAt) latestAt = row.created_at
    }
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
      .select('country_code, keywords, created_at')
      .in('country_code', COUNTRY_CODES)

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
        .select('country_code, keywords, created_at')
        .in('country_code', COUNTRY_CODES)
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
