import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { refreshGlobalTrends, TrendsFetchError } from '@/lib/trends-cache'
import { buildTrendsResponse } from '@/lib/trends-types'

/** 트렌드 캐시 저장 테이블: global_trends (테이블명 통일) */
const TRENDS_TABLE = 'global_trends'

const COUNTRY_CODES = ['KR', 'US', 'JP', 'TW', 'HK', 'GB', 'DE'] as const
/** 데이터 기준 시각이 이 값(1시간)보다 오래되면 응답 전 자동 RSS 갱신 */
const CACHE_TTL_MS = 3_600_000 // 1 * 60 * 60 * 1000
const isDev = process.env.NODE_ENV === 'development'

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
} as const

const RSS_ERROR_MESSAGE = '현재 구글 트렌드 데이터를 불러올 수 없습니다.'

function formatErrorPayload(err: unknown): Record<string, unknown> {
  const summary = {
    error: err instanceof TrendsFetchError ? RSS_ERROR_MESSAGE : '트렌드 데이터를 불러오지 못했습니다.',
  }
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

/** global_trends 테이블 행에서 마지막 갱신 시각(created_at 최대값) 반환. 없으면 null */
function getLastUpdatedAt(rows: { created_at: string | null }[]): string | null {
  let latest: string | null = null
  for (const r of rows) {
    if (r.created_at && (!latest || r.created_at > latest)) latest = r.created_at
  }
  return latest
}

/** GET: Cache-Aside. 데이터 기준(created_at)이 1시간 초과 시 응답 전 자동 RSS 갱신. ?refresh=1 이면 강제 갱신. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true'

    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from(TRENDS_TABLE)
      .select('country_code, keyword, rank, search_volume, started_at, news_items, title_ko, created_at')
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

    const list = rows ?? []
    const lastUpdatedAt = getLastUpdatedAt(list)
    const now = Date.now()
    const lastMs = lastUpdatedAt ? new Date(lastUpdatedAt).getTime() : 0
    const isStale = list.length === 0 || now - lastMs > CACHE_TTL_MS

    const selectTrendStatus = async (): Promise<{ country_code: string; source_type: 'API' | 'RSS'; last_updated_at: string | null; target_hours: number | null }[]> => {
      const { data: statusRows, error: statusErr } = await supabase
        .from('trend_status')
        .select('country_code, source_type, last_updated_at, target_hours')
        .in('country_code', COUNTRY_CODES)
      if (statusErr) return []
      return (statusRows ?? []) as { country_code: string; source_type: 'API' | 'RSS'; last_updated_at: string | null; target_hours: number | null }[]
    }

    if (forceRefresh || isStale) {
      if (isDev) console.log('[Trends GET]', forceRefresh ? '강제 갱신' : '1시간 경과로 자동 갱신', { lastUpdatedAt, isStale })
      try {
        await refreshGlobalTrends()
        const { data: freshRows, error: selectError } = await supabase
          .from(TRENDS_TABLE)
          .select('country_code, keyword, rank, search_volume, started_at, news_items, title_ko, created_at')
          .in('country_code', COUNTRY_CODES)
          .order('rank', { ascending: true })
        if (selectError) {
          console.error('[Trends GET] select after refresh', selectError)
          return NextResponse.json(formatErrorPayload(selectError), { status: 500, headers: JSON_HEADERS })
        }
        const trendStatusRows = await selectTrendStatus()
        const body = buildTrendsResponse(freshRows ?? [], trendStatusRows)
        return NextResponse.json({ ...body, refreshed: true }, { headers: JSON_HEADERS })
      } catch (refreshErr) {
        if (isDev) console.log('[Dev] Trends GET refresh failed, returning stale:', refreshErr)
        console.warn('[Trends GET] RSS 갱신 실패, 기존 데이터 반환:', refreshErr)
        if (list.length === 0) {
          const payload = formatErrorPayload(refreshErr) as Record<string, unknown>
          if (refreshErr instanceof TrendsFetchError) {
            payload.failedCountryCode = refreshErr.countryCode
            payload.attemptedUrls = refreshErr.attemptedUrls
          }
          return NextResponse.json(payload, { status: 500, headers: JSON_HEADERS })
        }
        const trendStatusRows = await selectTrendStatus()
        const body = buildTrendsResponse(list, trendStatusRows)
        return NextResponse.json({ ...body, refreshFailed: true }, { headers: JSON_HEADERS })
      }
    }

    const trendStatusRows = await selectTrendStatus()
    return NextResponse.json(buildTrendsResponse(list, trendStatusRows), { headers: JSON_HEADERS })
  } catch (err) {
    if (isDev) console.log('[Dev] Trends GET exception:', err, err instanceof Error ? err.stack : '')
    console.error('[Trends GET]', err)
    const payload = formatErrorPayload(err) as Record<string, unknown>
    if (err instanceof TrendsFetchError) {
      payload.failedCountryCode = err.countryCode
      payload.attemptedUrls = err.attemptedUrls
    }
    return NextResponse.json(payload, {
      status: 500,
      headers: JSON_HEADERS,
    })
  }
}
