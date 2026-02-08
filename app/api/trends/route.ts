import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { refreshGlobalTrends, isTrendsStale } from '@/lib/trends-cache'

const COUNTRY_CODES = ['KR', 'US', 'JP'] as const

/** GET: 공유 캐시(global_trends) 우선 조회. 없거나 오래됐으면 Firecrawl 갱신 후 반환. updatedAt 포함. */
export async function GET() {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('global_trends')
    .select('country_code, keywords, created_at')
    .in('country_code', COUNTRY_CODES)

  if (error) {
    console.error('[Trends GET]', error)
    return NextResponse.json(
      { error: '트렌드 데이터를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }

  const needRefresh = isTrendsStale(rows ?? [], [...COUNTRY_CODES])
  if (needRefresh && process.env.FIRECRAWL_API_KEY?.trim()) {
    await refreshGlobalTrends()
    const { data: fresh } = await supabase
      .from('global_trends')
      .select('country_code, keywords, created_at')
      .in('country_code', COUNTRY_CODES)
    return buildResponse(fresh ?? [])
  }

  return NextResponse.json(buildResponse(rows ?? []))
}

function buildResponse(
  rows: { country_code: string; keywords: unknown; created_at: string | null }[]
): {
  KR: string[]
  US: string[]
  JP: string[]
  updatedAt: string | null
} {
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
