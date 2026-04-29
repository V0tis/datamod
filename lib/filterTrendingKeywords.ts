import type { TrendItem, TrendRow } from '@/lib/trends-types'

/** 비즈니스·PM 리서치와 무관한 원시 트렌드(연예인 이름, 해외 시험/선거 쿼리 등)를 걸러냅니다. */
const IRRELEVANT_PATTERNS: RegExp[] = [
  /^[가-힣]{2,4}$/,
  /result \d{4}/i,
  /exit poll/i,
  /class \d+ result/i,
  /^[a-z]{1,2}$/i,
]

const BUSINESS_CATEGORY_KEYWORDS = [
  'AI',
  '플랫폼',
  '서비스',
  '앱',
  '솔루션',
  'SaaS',
  '기술',
  '시장',
  '산업',
  '스타트업',
  '투자',
]

/**
 * Google Trends 등에서 수집한 키워드 중 PM 시장 분석에 쓰기 부적절한 항목을 제외합니다.
 */
export function isBusinessRelevantKeyword(keyword: string): boolean {
  const k = keyword.trim()
  if (!k) return false
  if (IRRELEVANT_PATTERNS.some((pattern) => pattern.test(k))) return false
  return k.length > 3 || BUSINESS_CATEGORY_KEYWORDS.some((term) => k.includes(term))
}

function filterItemsByKeyword<T extends { keyword: string }>(items: T[]): T[] {
  return items.filter((item) => isBusinessRelevantKeyword(item.keyword.trim()))
}

/** 단일 국가 조회 결과: 필터 후 순위를 1…n으로 다시 매깁니다. */
export function filterAndRerankTrendRows(rows: TrendRow[]): TrendRow[] {
  const filtered = filterItemsByKeyword(rows).sort((a, b) => a.rank - b.rank)
  return filtered.map((r, i) => ({ ...r, rank: i + 1 }))
}

/** 여러 국가 행이 섞인 경우: 국가별로 필터·순위 재부여 */
export function filterAndRerankTrendRowsAllCountries(rows: TrendRow[]): TrendRow[] {
  const byCountry = new Map<string, TrendRow[]>()
  for (const r of rows) {
    const list = byCountry.get(r.country_code) ?? []
    list.push(r)
    byCountry.set(r.country_code, list)
  }
  const out: TrendRow[] = []
  for (const list of byCountry.values()) {
    const filtered = filterItemsByKeyword(list).sort((a, b) => a.rank - b.rank)
    filtered.forEach((r, i) => out.push({ ...r, rank: i + 1 }))
  }
  return out
}

/** 클라이언트 TrendItem 배열 (이중 방어) */
export function filterTrendItems(items: TrendItem[]): TrendItem[] {
  const filtered = filterItemsByKeyword(items)
  return filtered.map((t, i) => ({ ...t, rank: i + 1 }))
}
