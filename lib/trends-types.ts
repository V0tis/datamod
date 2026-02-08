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
