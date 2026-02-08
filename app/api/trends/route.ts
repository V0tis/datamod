import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const COUNTRY_CODES = ['KR', 'US', 'JP'] as const

/** GET: global_trends 테이블에서 캐시된 국가별 키워드 조회 (캐시 우선) */
export async function GET() {
  const supabase = await createClient()
  const { data: rows, error } = await supabase
    .from('global_trends')
    .select('country_code, keywords')
    .in('country_code', COUNTRY_CODES)

  if (error) {
    console.error('[Trends GET]', error)
    return NextResponse.json(
      { error: '트렌드 데이터를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }

  const map: Record<string, string[]> = { KR: [], US: [], JP: [] }
  for (const row of rows ?? []) {
    const code = row.country_code as string
    const keywords = Array.isArray(row.keywords) ? row.keywords : []
    if (COUNTRY_CODES.includes(code as (typeof COUNTRY_CODES)[number])) {
      map[code] = keywords.filter((k): k is string => typeof k === 'string').slice(0, 10)
    }
  }

  return NextResponse.json({
    KR: map.KR,
    US: map.US,
    JP: map.JP,
  })
}
