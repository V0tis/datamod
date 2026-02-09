import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { refreshGlobalTrends, TrendsFetchError } from '@/lib/trends-cache'
import { buildTrendsResponse } from '@/lib/trends-types'

/** 트렌드 캐시 저장 테이블: global_trends (테이블명 통일) */
const TRENDS_TABLE = 'global_trends'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const
const DEFAULT_HOURS = 24
const isDev = process.env.NODE_ENV === 'development'
const COUNTRY_CODES = ['KR', 'US', 'JP', 'TW', 'HK', 'GB', 'DE'] as const

function parseHours(value: unknown): number {
  if (value == null) return DEFAULT_HOURS
  const n = typeof value === 'string' ? parseInt(value, 10) : Number(value)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_HOURS
}

/** POST: 공유 캐시 수동 갱신. body { hours?: number } 지원, 기본 24. */
export async function POST(req: Request) {
  try {
    let hours = DEFAULT_HOURS
    try {
      const body = await req.json().catch(() => ({}))
      hours = parseHours(body?.hours)
    } catch {
      /* ignore */
    }
    await refreshGlobalTrends(hours)

    const supabase = await createClient()
    const { data: rows, error } = await supabase
      .from(TRENDS_TABLE)
      .select('country_code, keyword, rank, search_volume, started_at, analysis_keywords, picture_url, news_items, title_ko, news_items_ko, created_at')
      .in('country_code', COUNTRY_CODES)
      .order('rank', { ascending: true })

    if (error) {
      if (isDev) console.log('[Dev] Trends update SELECT error:', error)
      console.error('[Trends update] SELECT after save', error)
      return NextResponse.json(
        { error: '저장 후 데이터를 불러오지 못했습니다.', success: true },
        { status: 200, headers: JSON_HEADERS }
      )
    }

    const data = buildTrendsResponse(rows ?? [])
    return NextResponse.json({ success: true, data }, { headers: JSON_HEADERS })
  } catch (err) {
    if (isDev) console.log('[Dev] Trends update exception:', err, err instanceof Error ? err.stack : '')
    console.error('[Trends update]', err)
    const payload: {
      error: string
      message?: string
      failedCountryCode?: string
      attemptedUrls?: string[]
    } = {
      error: err instanceof TrendsFetchError
        ? '현재 구글 트렌드 데이터를 불러올 수 없습니다.'
        : '트렌드 갱신 중 오류가 발생했습니다.',
    }
    if (isDev && err) {
      payload.message = err instanceof Error ? err.message : String(err)
    }
    if (err instanceof TrendsFetchError) {
      payload.failedCountryCode = err.countryCode
      payload.attemptedUrls = err.attemptedUrls
    }
    return NextResponse.json(payload, { status: 500, headers: JSON_HEADERS })
  }
}
