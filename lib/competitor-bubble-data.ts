import type { Competitor } from '@/components/research/CompetitorVisualMap'

export type CompetitorScatterRow = {
  name?: string
  positioning?: string
  target_market?: string
  market_presence?: number
  innovation_level?: number
  key_feature?: string
  pricing?: string
  differentiation?: string
  /** 시장 점유·성장성 좌표 산정 근거 */
  score_rationale?: string
}

type Tier = 'leader' | 'challenger' | 'niche' | 'emerging'

const TIER_FILL: Record<Tier, string> = {
  leader: '#3b82f6',
  challenger: '#10b981',
  niche: '#f59e0b',
  emerging: '#94a3b8',
}

function inferTier(c: CompetitorScatterRow, index: number, total: number): Tier {
  const pos = (c.positioning ?? '').toLowerCase()
  if (/리더|선도|1위|시장 지배|대표|최대/.test(pos)) return 'leader'
  if (/도전|challenger|2위|3위|추격/.test(pos)) return 'challenger'
  if (/니치|niche|특화|전문|틈새/.test(pos)) return 'niche'
  if (/초기|스타트업|신규|신생|초창기|성장|확대|부상|신흥|emerging/.test(pos)) return 'emerging'
  if (total <= 2) return index === 0 ? 'leader' : 'challenger'
  if (total <= 3) return index === 0 ? 'leader' : index === 1 ? 'challenger' : 'emerging'
  const q = Math.ceil(total / 4)
  if (index < q) return 'leader'
  if (index < q * 2) return 'challenger'
  if (index < q * 3) return 'niche'
  return 'emerging'
}

function clamp1to10(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n)))
}

function heuristicXY(c: CompetitorScatterRow, i: number): { x: number; y: number } {
  const pricing = `${c.pricing ?? ''}`.toLowerCase()
  const pos = `${c.positioning ?? ''} ${c.target_market ?? ''}`.toLowerCase()
  const diff = `${c.differentiation ?? ''} ${c.key_feature ?? ''}`
  let x = 5
  if (/무료|freemium|저가|low\s*cost|저렴|low\s*price/.test(pricing)) x = 3
  else if (/프리미엄|고가|premium|enterprise|엔터프라이즈|상위/.test(pricing)) x = 8
  else if (/중간|mid|중저가/.test(pricing)) x = 5
  let y = 5
  const diffLen = diff.trim().length
  y = Math.min(9, Math.max(2, 4 + Math.min(4, diffLen * 0.12)))
  if (/니치|특화|차별|독점|only|unique|vertical/.test(pos + diff)) y = Math.min(10, y + 1)
  if (/범용|플랫폼|종합|horizontal|suite|all-in-one/.test(pos + diff)) y = Math.max(2, y - 1)
  x += ((i * 11) % 7) - 3
  y += ((i * 13) % 5) - 2
  return { x: clamp1to10(x), y: clamp1to10(y) }
}

export type ScatterPayload = {
  x: number
  y: number
  name: string
  positioning?: string
  differentiation?: string
  score_rationale?: string
  inferred?: boolean
  size: number
  tier: Tier
  fill: string
  /** 분석 키워드(자사)와 이름이 일치할 때 */
  isOurCompany?: boolean
}

/** 시장 존재감·혁신 점수 + 추정 위치 + 티어 색 + 규모(버블 반경 스케일) */
export function toScatterPayload(competitors: CompetitorScatterRow[]): ScatterPayload[] {
  const used = new Map<string, number>()
  return competitors.slice(0, 14).map((c, i) => {
    const name = (c.name && String(c.name).trim()) || `경쟁사 ${i + 1}`
    const mp = c.market_presence
    const il = c.innovation_level
    const hasMp = typeof mp === 'number' && Number.isFinite(mp)
    const hasIl = typeof il === 'number' && Number.isFinite(il)
    let x: number
    let y: number
    let inferred = false
    if (hasMp && hasIl) {
      x = clamp1to10(mp!)
      y = clamp1to10(il!)
    } else if (hasMp) {
      x = clamp1to10(mp!)
      const h = heuristicXY(c, i)
      y = h.y
      inferred = true
    } else if (hasIl) {
      const h = heuristicXY(c, i)
      x = h.x
      y = clamp1to10(il!)
      inferred = true
    } else {
      const h = heuristicXY(c, i)
      x = h.x
      y = h.y
      inferred = true
    }
    const key = `${x},${y}`
    const n = (used.get(key) ?? 0) + 1
    used.set(key, n)
    if (n > 1) {
      const bump = (n - 1) * 0.22
      x = Math.min(10, x + bump)
      y = Math.min(10, y + bump * 0.65)
      inferred = true
    }
    const tier = inferTier(c as Competitor, i, competitors.length)
    const sizeBase =
      typeof mp === 'number' && Number.isFinite(mp)
        ? mp * 10 + 40
        : typeof il === 'number' && Number.isFinite(il)
          ? il * 9 + 36
          : 50 + (competitors.length - i) * 4

    return {
      x,
      y,
      name,
      positioning: typeof c.positioning === 'string' ? c.positioning.trim() : undefined,
      differentiation: typeof c.differentiation === 'string' ? c.differentiation.trim() : undefined,
      score_rationale: typeof c.score_rationale === 'string' ? c.score_rationale.trim() : undefined,
      inferred,
      size: Math.min(120, Math.max(40, sizeBase)),
      tier,
      fill: TIER_FILL[tier],
    }
  })
}
