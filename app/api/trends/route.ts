import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TrendsFetchError } from '@/lib/trends-cache'
import { buildTrendsResponse } from '@/lib/trends-types'

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

/** GET: 공유 캐시(global_trends)만 조회. RSS 수집은 트렌드 페이지 [트렌드 갱신] 버튼(POST /api/trends/update)에서만 수행. */
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

    return NextResponse.json(buildTrendsResponse(rows ?? []), { headers: JSON_HEADERS })
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
