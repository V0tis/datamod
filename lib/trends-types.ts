/** 클라이언트/API 공용 트렌드 아이템 타입 */
export interface TrendItem {
  keyword: string
  rank: number
  search_volume: string | null
  started_at: string | null
  analysis_keywords: string[]
}

export interface TrendsResponse {
  KR: TrendItem[]
  US: TrendItem[]
  JP: TrendItem[]
  updatedAt: string | null
}

/** DB 행 타입 (API 공용) */
export type TrendRow = {
  country_code: string
  keyword: string
  rank: number
  search_volume: string | null
  started_at: string | null
  analysis_keywords: string[] | null
  created_at: string | null
}

const COUNTRY_CODES = ['KR', 'US', 'JP'] as const

function rowToItem(r: TrendRow): TrendItem {
  return {
    keyword: r.keyword,
    rank: r.rank,
    search_volume: r.search_volume ?? null,
    started_at: r.started_at ?? null,
    analysis_keywords: Array.isArray(r.analysis_keywords) ? r.analysis_keywords : [],
  }
}

/** DB 행 배열을 TrendsResponse로 변환 (GET/update 공용) */
export function buildTrendsResponse(rows: TrendRow[]): TrendsResponse {
  const map: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  let latestAt: string | null = null
  for (const row of rows) {
    const code = row.country_code
    if (COUNTRY_CODES.includes(code as (typeof COUNTRY_CODES)[number])) {
      map[code].push(rowToItem(row))
    }
    if (row.created_at && (!latestAt || row.created_at > latestAt)) latestAt = row.created_at
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

/** API가 문자열 배열(레거시)을 줄 수 있을 때 정규화 */
export function normalizeTrendItems(raw: TrendItem[] | string[] | undefined): TrendItem[] {
  if (!Array.isArray(raw)) return []
  if (raw.length === 0) return []
  const first = raw[0]
  if (typeof first === 'string') {
    return (raw as string[]).map((keyword, i) => ({
      keyword,
      rank: i + 1,
      search_volume: null,
      started_at: null,
      analysis_keywords: [],
    }))
  }
  return raw as TrendItem[]
}
