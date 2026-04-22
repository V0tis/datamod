import type { DashboardKeywordRow } from '@/lib/types/dashboard-keyword-row'
import type { TrendItem } from '@/lib/trends-types'
import type { ScatterKeywordPoint } from '@/lib/types/scatter-keyword-point'

function hashKeyword(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function buildDashboardScatterPoints(
  trendItems: TrendItem[],
  recentReports: Array<{ keyword: string; opportunity_score?: number | null }>,
  liveRows: DashboardKeywordRow[],
  countryCode: string
): ScatterKeywordPoint[] {
  const map = new Map<string, ScatterKeywordPoint>()

  for (const row of liveRows) {
    map.set(row.keyword, {
      keyword: row.keyword,
      기회점수: clamp(row.opportunity_score, 5, 99),
      리스크점수: clamp(row.risk_score, 5, 99),
      트렌드강도: clamp(Math.round((row.opportunity_score + row.risk_score) / 2), 25, 100),
      countryCode,
    })
  }

  for (const r of recentReports) {
    if (r.opportunity_score == null) continue
    if (map.has(r.keyword)) continue
    const h = hashKeyword(r.keyword)
    map.set(r.keyword, {
      keyword: r.keyword,
      기회점수: clamp(r.opportunity_score, 8, 98),
      리스크점수: clamp(28 + (h % 52), 15, 90),
      트렌드강도: clamp(35 + (h % 45), 30, 98),
      countryCode,
    })
  }

  for (const t of trendItems.slice(0, 14)) {
    if (map.has(t.keyword)) continue
    const rank = typeof t.rank === 'number' ? t.rank : 5
    const h = hashKeyword(t.keyword)
    map.set(t.keyword, {
      keyword: t.keyword,
      기회점수: clamp(82 - rank * 5 + (h % 9), 18, 96),
      리스크점수: clamp(30 + rank * 4 + (h % 14), 20, 88),
      트렌드강도: clamp(105 - rank * 7 + (h % 12), 28, 100),
      countryCode,
    })
  }

  return Array.from(map.values())
}

export function inferTrendCategory(keyword: string): string {
  const k = keyword.toLowerCase()
  if (/바둑|게임|e스포츠|esports|롤|원신|스팀|닌텐도|플레이/.test(k)) return '게임'
  if (/ai|인공지능|saas|클라우드|데이터|반도체|개발|테크/.test(k)) return '테크'
  if (/배송|커머스|쇼핑|이커머스|마켓|유통|뷰티|패션/.test(k)) return '커머스'
  if (/헬스|건강|다이어트|병원|의료|영양|핏/.test(k)) return '헬스'
  if (/금융|결제|투자|페이|대출|코인|주식/.test(k)) return '금융'
  return '기타'
}
