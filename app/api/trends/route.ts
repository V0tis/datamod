import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { refreshTrendsForCountry, TrendsFetchError, TRENDS_CACHE_TTL_MS } from '@/lib/trends-cache'
import { buildTrendsResponse } from '@/lib/trends-types'

/** 트렌드 캐시 저장 테이블: global_trends. 국가별 캐시, 1시간 유효. */
const TRENDS_TABLE = 'global_trends'

const COUNTRY_CODES = ['KR', 'US', 'JP', 'TW', 'HK', 'GB', 'DE'] as const
type CountryCode = (typeof COUNTRY_CODES)[number]

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

function parseCountry(param: string | null): CountryCode {
  const c = (param ?? 'KR').trim().toUpperCase()
  return COUNTRY_CODES.includes(c as CountryCode) ? (c as CountryCode) : 'KR'
}

/** global_trends 행에서 해당 국가의 마지막 갱신 시각(created_at 최대값) 반환. 없으면 null */
function getLastUpdatedAt(rows: { created_at: string | null }[]): string | null {
  let latest: string | null = null
  for (const r of rows) {
    if (r.created_at && (!latest || r.created_at > latest)) latest = r.created_at
  }
  return latest
}

/** GET: 선택 국가만 조회. DB에 1시간 이내 데이터 있으면 반환, 없으면 해당 국가만 RSS 수집 후 저장·반환. ?country=KR & ?refresh=1 지원. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const country = parseCountry(searchParams.get('country'))
    const forceRefresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true'

    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from(TRENDS_TABLE)
      .select('country_code, keyword, rank, search_volume, started_at, news_items, title_ko, created_at')
      .eq('country_code', country)
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
    const cacheValid = list.length > 0 && now - lastMs <= TRENDS_CACHE_TTL_MS
    const shouldRefresh = forceRefresh || !cacheValid

    const selectTrendStatus = async (): Promise<{ country_code: string; source_type: 'API' | 'RSS'; last_updated_at: string | null; target_hours: number | null }[]> => {
      const { data: statusRows, error: statusErr } = await supabase
        .from('trend_status')
        .select('country_code, source_type, last_updated_at, target_hours')
        .eq('country_code', country)
      if (statusErr) return []
      return (statusRows ?? []) as { country_code: string; source_type: 'API' | 'RSS'; last_updated_at: string | null; target_hours: number | null }[]
    }

    if (shouldRefresh) {
      const hasStale = list.length > 0
      // Stale-while-revalidate: return stale data immediately and refresh in background to avoid blocking the client.
      if (hasStale && !forceRefresh) {
        const trendStatusRows = await selectTrendStatus()
        const body = buildTrendsResponse(list, trendStatusRows)
        refreshTrendsForCountry(country).catch((err) => {
          if (isDev) console.log('[Trends GET] background refresh failed:', err)
          console.warn('[Trends GET] background refresh failed:', err?.message ?? err)
        })
        return NextResponse.json({ ...body, revalidating: true }, { headers: JSON_HEADERS })
      }
      if (isDev) console.log('[Trends GET]', forceRefresh ? '강제 갱신' : '캐시 없음/만료', { country, lastUpdatedAt })
      try {
        await refreshTrendsForCountry(country)
        const { data: freshRows, error: selectError } = await supabase
          .from(TRENDS_TABLE)
          .select('country_code, keyword, rank, search_volume, started_at, news_items, title_ko, created_at')
          .eq('country_code', country)
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
