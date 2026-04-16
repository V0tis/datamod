/**
 * Deterministic Opportunity Score computation.
 * Replaces LLM-based scoring to reduce latency and API cost.
 * Uses structured outputs from trend, competition, strategy, and execution steps.
 */

export type OpportunityScoreInput = {
  market_score: number
  positive_signals_count: number
  neutral_signals_count: number
  competitor_count: number
  opportunities_count: number
  risks_count: number
  product_actions_count: number
}

export type OpportunityScoreBreakdown = {
  market_growth: number
  trend_momentum: number
  funding_signals: number
  competition_density: number
  risk_factors: number
}

export type OpportunityScoreOutput = {
  opportunity_score: number
  breakdown: OpportunityScoreBreakdown
  /** 좌측 게이지 하단: 건수·구성 등 객관 지표 한 줄 (레거시 필드명) */
  score_reasoning: string
  /** 동일 문구 — UI·저장용 명시 키 */
  summary_text: string
}

/**
 * Compute opportunity score from structured pipeline outputs.
 * Formula:
 * - market_growth: (market_score - 50) * 0.4, range -20..+20
 * - trend_momentum: min(positive*4 + neutral*2 + small bonus when positives>=2, 22)
 * - funding_signals: min(opportunities*3 + actions*2, 15)
 * - competition_density: -min(competitors*3, 25)
 * - risk_factors: -min(risks*4, 25)
 */
export function computeOpportunityScore(
  input: OpportunityScoreInput
): OpportunityScoreOutput {
  const signalLift =
    input.positive_signals_count >= 3 ? 3 : input.positive_signals_count >= 1 ? 1 : 0
  const market_growth = Math.round(
    Math.min(20, Math.max(-20, (input.market_score - 50) * 0.45 + signalLift))
  )
  const trend_momentum = Math.round(
    Math.min(
      input.positive_signals_count * 4 + input.neutral_signals_count * 2 + (input.positive_signals_count >= 2 ? 2 : 0),
      22
    )
  )
  const funding_signals = Math.round(
    Math.min(
      input.opportunities_count * 3 + input.product_actions_count * 2,
      15
    )
  )
  const competition_density = -Math.min(input.competitor_count * 3, 25)
  const risk_factors = -Math.min(input.risks_count * 4, 25)

  const base = 50
  const rawScore =
    base +
    market_growth +
    trend_momentum +
    funding_signals +
    competition_density +
    risk_factors
  const opportunity_score = Math.round(
    Math.min(100, Math.max(0, rawScore))
  )

  const parts: string[] = []
  if (input.positive_signals_count > 0) {
    parts.push(`긍정 시그널 ${input.positive_signals_count}건`)
  }
  if (input.competitor_count > 0) {
    parts.push(`경쟁사 ${input.competitor_count}곳`)
  }
  if (input.risks_count > 0) {
    parts.push(`리스크 ${input.risks_count}건`)
  }
  if (input.opportunities_count > 0) {
    parts.push(`기회 요인 ${input.opportunities_count}건`)
  }
  const summary_text =
    parts.length > 0
      ? `${parts.join(', ')}을 반영한 수치입니다.`
      : `시장·경쟁·기회·리스크 신호를 반영한 수치입니다.`

  return {
    opportunity_score,
    breakdown: {
      market_growth,
      trend_momentum,
      funding_signals,
      competition_density,
      risk_factors,
    },
    score_reasoning: summary_text,
    summary_text,
  }
}
