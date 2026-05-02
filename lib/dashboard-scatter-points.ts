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

/** 트렌드 파생 점: 키워드별로 (50,50) 주변에 넓게 퍼지도록 극좌표 스프레드 */
function trendDerivedScores(keyword: string, index: number, rank: number): { o: number; r: number } {
  const h = hashKeyword(`${keyword}:${index}`)
  const angle = ((h % 628) / 628) * 2 * Math.PI
  const rad = 16 + (h % 28)
  let o = 50 + Math.cos(angle) * rad
  let rs = 50 + Math.sin(angle) * rad
  const rankN = typeof rank === 'number' && rank > 0 ? rank : index + 1
  o += (12 - Math.min(rankN, 10)) * 1.4
  rs += ((h >> 5) % 9) - 4
  const jitter = ((h * 7 + index * 13) % 17) - 8
  o += jitter
  rs += ((h >> 2) % 17) - 8
  return { o: clamp(o, 10, 96), r: clamp(rs, 10, 96) }
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
    const oBase = clamp(r.opportunity_score, 8, 98)
    const riskBase = clamp(32 + (h % 48) + ((r.opportunity_score ?? 50) % 7), 15, 92)
    map.set(r.keyword, {
      keyword: r.keyword,
      기회점수: oBase,
      리스크점수: riskBase,
      트렌드강도: clamp(38 + (h % 42), 30, 98),
      countryCode,
    })
  }

  const trendsSlice = trendItems.slice(0, 14)
  for (let i = 0; i < trendsSlice.length; i++) {
    const t = trendsSlice[i]
    if (map.has(t.keyword)) continue
    const rank = typeof t.rank === 'number' ? t.rank : i + 1
    const { o, r } = trendDerivedScores(t.keyword, i, rank)
    const h = hashKeyword(t.keyword)
    map.set(t.keyword, {
      keyword: t.keyword,
      기회점수: o,
      리스크점수: r,
      트렌드강도: clamp(42 + (rank % 8) * 5 + (h % 15), 28, 100),
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
