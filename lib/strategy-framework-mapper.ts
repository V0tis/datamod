/**
 * 시장 지표 → Porter 5 Forces 점수(1–5) 및 JTBD 3축 보강.
 * LLM 출력이 없을 때 breakdown·전략 평가로 보간한다.
 */

import type { OpportunityScoreBreakdown } from '@/lib/ai/opportunity-score-formula'

export type PorterFiveScores = {
  new_entrants: number
  supplier_power: number
  buyer_power: number
  substitutes: number
  rivalry: number
}

export type Porter5ForcesShape = {
  rivalry?: string[]
  supplier_power?: string[]
  buyer_power?: string[]
  substitutes?: string[]
  new_entrants?: string[]
  scores?: Partial<PorterFiveScores>
}

export type JtbdShape = {
  main_jobs?: string[]
  pains?: string[]
  gains?: string[]
  functional_jobs?: string[]
  social_jobs?: string[]
  emotional_jobs?: string[]
}

function clamp15(n: number): number {
  if (!Number.isFinite(n)) return 3
  return Math.min(5, Math.max(1, Math.round(n)))
}

/** breakdown 델타(-25~+20대)를 1~5 강도로 스케일 */
function deltaToPorter(d: number, invert = false): number {
  const x = invert ? -d : d
  return clamp15(3 + x / 10)
}

/**
 * 기회 점수 breakdown + 경쟁 강도 + 전략 평가로 Porter 5 점수 추정.
 * 높을수록 해당 힘이 강함(산업 수익성에 대한 압박).
 */
export function inferPorterScoresFromSignals(
  breakdown: Partial<OpportunityScoreBreakdown> | null | undefined,
  competitionIntensity?: 'low' | 'medium' | 'high' | string,
  strategyEval?: {
    competition_risk?: number
    growth_potential?: number
    market_attractiveness?: number
  } | null
): PorterFiveScores {
  const b = breakdown ?? {}
  const compDelta = typeof b.competition_density === 'number' ? b.competition_density : 0
  const riskDelta = typeof b.risk_factors === 'number' ? b.risk_factors : 0
  const growthDelta = typeof b.market_growth === 'number' ? b.market_growth : 0
  const trendDelta = typeof b.trend_momentum === 'number' ? b.trend_momentum : 0
  const fundDelta = typeof b.funding_signals === 'number' ? b.funding_signals : 0

  // 경쟁 밀도(음수일수록 경쟁사 많음) → 기존 업체 간 경쟁(rivalry) 상승
  let rivalry = deltaToPorter(compDelta, true)
  if (competitionIntensity === 'high') rivalry = Math.max(rivalry, 4)
  if (competitionIntensity === 'low') rivalry = Math.min(rivalry, 2)
  if (typeof strategyEval?.competition_risk === 'number') {
    const cr = strategyEval.competition_risk
    rivalry = clamp15((rivalry + (cr / 10) * 4 + 1) / 2)
  }

  // 매력적인 시장 + 트렌드 → 신규 진입 유인(진입 위협)
  const attract = deltaToPorter(growthDelta + trendDelta * 0.6)
  const barrier = deltaToPorter(compDelta, true)
  const new_entrants = clamp15((attract + barrier) / 2)

  // 공급자 교섭력: 리스크·자금 조달 난이도 쪽으로 보수적 추정
  const supplier_power = deltaToPorter(riskDelta * 0.8 - fundDelta * 0.3, true)

  // 구매자 교섭력: 정보·대안이 많을수록(트렌드·성장 시그널) 상승
  const buyer_power = deltaToPorter(trendDelta + Math.abs(growthDelta) * 0.4)

  // 대체재: 시장 성장·모멘텀이 높을수록 대체 서비스·방식 경쟁 심화 가정
  let substitutes = deltaToPorter(trendDelta * 0.7 + growthDelta * 0.5)
  if (typeof strategyEval?.growth_potential === 'number' && strategyEval.growth_potential >= 7) {
    substitutes = Math.min(5, substitutes + 1)
  }

  return {
    new_entrants: clamp15(new_entrants),
    supplier_power: clamp15(supplier_power),
    buyer_power: clamp15(buyer_power),
    substitutes: clamp15(substitutes),
    rivalry: clamp15(rivalry),
  }
}

function parseScore(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return clamp15(v)
  if (typeof v === 'string' && v.trim()) {
    const n = parseInt(v, 10)
    if (!Number.isNaN(n)) return clamp15(n)
  }
  return undefined
}

/** LLM이 준 scores와 추정치 병합 (유효한 AI 점수 우선) */
export function mergePorterScores(
  porter: Porter5ForcesShape | null | undefined,
  inferred: PorterFiveScores
): PorterFiveScores {
  const s = porter?.scores
  const pick = (key: keyof PorterFiveScores): number => {
    const ai = s ? parseScore(s[key]) : undefined
    if (ai != null) return ai
    return inferred[key]
  }
  return {
    new_entrants: pick('new_entrants'),
    supplier_power: pick('supplier_power'),
    buyer_power: pick('buyer_power'),
    substitutes: pick('substitutes'),
    rivalry: pick('rivalry'),
  }
}

/** JTBD 3축: AI 필드 우선, 없으면 기존 main_jobs·pains·gains에서 보간 */
export function resolveJtbdTriad(jtbd: JtbdShape | null | undefined): {
  functional: string[]
  social: string[]
  emotional: string[]
} {
  if (!jtbd) {
    return { functional: [], social: [], emotional: [] }
  }
  let functional = (jtbd.functional_jobs ?? []).filter(Boolean).slice(0, 6)
  if (functional.length === 0) {
    functional = [...(jtbd.main_jobs ?? []).slice(0, 3), ...(jtbd.pains ?? []).slice(0, 3)].filter(Boolean)
  }

  let social = (jtbd.social_jobs ?? []).filter(Boolean).slice(0, 6)
  if (social.length === 0) {
    social = (jtbd.gains ?? [])
      .filter((g) => /팀|동료|상사|브랜드|평판|인정|공유|소속|문화|협업|신뢰/i.test(g))
      .slice(0, 4)
  }
  if (social.length === 0) {
    social = [
      '동료·조직 내 신뢰와 평판을 유지하며 의사결정을 정당화하려는 니즈',
      '검증된 근거로 스테이크홀더를 설득하려는 니즈',
    ]
  }

  let emotional = (jtbd.emotional_jobs ?? []).filter(Boolean).slice(0, 6)
  if (emotional.length === 0) {
    const gains = jtbd.gains ?? []
    emotional = gains
      .filter((g) => !/팀|동료|상사|브랜드|평판|인정|공유|소속|문화|협업|신뢰/i.test(g))
      .slice(0, 5)
    if (emotional.length === 0 && gains.length > 0) {
      emotional = gains.slice(0, 4)
    }
  }
  if (emotional.length === 0 && (jtbd.pains ?? []).length > 0) {
    emotional = (jtbd.pains ?? []).slice(0, 2).map((p) => `스트레스·불확실성 완화: ${p}`)
  }

  return {
    functional: [...new Set(functional)],
    social: [...new Set(social)],
    emotional: [...new Set(emotional)].filter(Boolean),
  }
}

export function enrichPorter5Forces(
  porter: Porter5ForcesShape | null | undefined,
  breakdown: Partial<OpportunityScoreBreakdown> | null | undefined,
  strategicDecisionLayer?: { competition_intensity?: 'low' | 'medium' | 'high' } | null,
  strategyEvaluation?: { competition_risk?: number; growth_potential?: number; market_attractiveness?: number } | null
): Porter5ForcesShape {
  const inferred = inferPorterScoresFromSignals(
    breakdown,
    strategicDecisionLayer?.competition_intensity,
    strategyEvaluation ?? undefined
  )
  const scores = mergePorterScores(porter, inferred)
  const base: Porter5ForcesShape = porter ? { ...porter } : {}
  return {
    ...base,
    scores,
  }
}
