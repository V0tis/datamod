/**
 * Analysis Quality Scoring: trustworthiness metric for PM-focused AI analysis.
 * Scores based on: fact coverage, signal consistency, hypothesis discipline, uncertainty disclosure.
 * Does NOT evaluate factual correctness. No external validation.
 */

export type QualityConfidenceLabel = 'High' | 'Medium' | 'Low' | 'Weak'

export interface AnalysisQualityScore {
  score: number
  label: QualityConfidenceLabel
  explanation: string
}

/** Input shape compatible with Consensus and analysis_results. */
export interface AnalysisQualityInput {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: { score?: number; trend?: string; ratio?: { positive?: number; neutral?: number; negative?: number } }
  impactAnalysis?: Array<{ subject?: string; score?: number; reason?: string }>
  strategicSummary?: {
    summary?: string
    opportunity?: string
    threat?: string
    actionItems?: string[]
  }
  metadata?: { confidence?: number; dataPeriod?: string }
}

const OVERCONFIDENCE_PHRASES = [
  '반드시', '확실히', '필연적', '절대', '100%', '무조건', '틀림없이',
  'definitely', 'certainly', 'absolutely', 'without doubt',
]
const UNCERTAINTY_PHRASES = [
  '정보 부족', '추가 검증 필요', '가설', '가능성', '알 수 없음', '제한적',
  '검토 필요', '추가 확인', '불확실', '추정', '~로 보임', '~으로 추정',
  'hypothesis', 'uncertain', 'limited data', 'further validation',
]

function hasOverconfidentLanguage(text: string): boolean {
  const lower = text.toLowerCase()
  return OVERCONFIDENCE_PHRASES.some((p) => lower.includes(p.toLowerCase()))
}

function hasUncertaintyDisclosure(text: string): boolean {
  const lower = text.toLowerCase()
  return UNCERTAINTY_PHRASES.some((p) => lower.includes(p.toLowerCase()))
}

/**
 * Compute analysis quality score (0–100) based on trustworthiness signals.
 * Penalizes overconfident hypotheses; rewards explicit uncertainty.
 */
export function computeAnalysisQualityScore(input: AnalysisQualityInput | null | undefined): AnalysisQualityScore {
  if (!input || typeof input !== 'object') {
    return {
      score: 0,
      label: 'Weak',
      explanation: '분석 데이터가 없어 품질 점수를 산출할 수 없습니다.',
    }
  }

  const parts: string[] = []
  let factCoverage = 0 // 0–25
  let signalConsistency = 0 // 0–25
  let hypothesisDiscipline = 0 // 0–25
  let uncertaintyDisclosure = 0 // 0–25

  // --- 1. Fact coverage: verifiable/observed data presence ---
  const newsCount = Array.isArray(input.marketNews) ? input.marketNews.filter((s) => typeof s === 'string' && s.trim().length > 0).length : 0
  const painCount = Array.isArray(input.painPoints) ? input.painPoints.filter((s) => typeof s === 'string' && s.trim().length > 0).length : 0
  if (newsCount >= 3) {
    factCoverage += 12
    parts.push('핵심 뉴스 3건 이상')
  } else if (newsCount >= 1) {
    factCoverage += 6
    parts.push('핵심 뉴스 있음')
  }
  if (painCount >= 1) {
    factCoverage += 8
    parts.push('페인포인트·미충족 니즈 명시')
  }
  if (factCoverage < 10) parts.push('사실 기반 데이터가 제한적')

  // --- 2. Signal consistency: structured signals with reasons ---
  const impact = input.impactAnalysis ?? []
  const impactWithReasons = impact.filter((i) => typeof i.reason === 'string' && (i.reason ?? '').trim().length > 0).length
  if (impact.length >= 5 && impactWithReasons >= 4) {
    signalConsistency += 15
    parts.push('임팩트 지표에 근거 제시')
  } else if (impact.length >= 3 && impactWithReasons >= 2) {
    signalConsistency += 10
    parts.push('일부 지표에 근거 있음')
  }
  const ratio = input.sentiment?.ratio
  if (ratio && typeof ratio.positive === 'number' && typeof ratio.negative === 'number') {
    signalConsistency += 8
    parts.push('감성 비율 구체화')
  }
  if (typeof input.competitorTrends === 'string' && input.competitorTrends.trim().length > 5) {
    signalConsistency += 2
  }

  // --- 3. Hypothesis discipline: penalize overconfidence, reward hedging ---
  const summary = (input.strategicSummary?.summary ?? '').trim()
  const opportunity = (input.strategicSummary?.opportunity ?? '').trim()
  const combined = `${summary} ${opportunity}`.trim()
  if (hasOverconfidentLanguage(combined)) {
    hypothesisDiscipline = Math.max(0, 15 - 10) // penalty
    parts.push('과도한 확신 표현 감지로 감점')
  } else if (combined.length > 20) {
    hypothesisDiscipline += 15
    parts.push('가설·해석이 절제된 표현')
  }
  if (Array.isArray(input.strategicSummary?.actionItems) && input.strategicSummary!.actionItems!.length >= 1) {
    hypothesisDiscipline += 8
    parts.push('액션 항목 제시')
  }

  // --- 4. Uncertainty disclosure: explicit limits, threat, moderate confidence ---
  const threat = (input.strategicSummary?.threat ?? '').trim()
  const compTrends = (input.competitorTrends ?? '').trim()
  if (threat.length > 5) {
    uncertaintyDisclosure += 10
    parts.push('리스크·위협 명시')
  }
  if (hasUncertaintyDisclosure(summary) || hasUncertaintyDisclosure(compTrends) || compTrends.includes('정보 부족')) {
    uncertaintyDisclosure += 10
    parts.push('불확실성·한계 인정')
  }
  const metaConf = typeof input.metadata?.confidence === 'number' ? Math.max(0, Math.min(100, input.metadata.confidence)) : null
  if (metaConf != null) {
    if (metaConf >= 90) {
      uncertaintyDisclosure += 0 // very high confidence can imply overconfidence; no extra reward
    } else if (metaConf >= 50) {
      uncertaintyDisclosure += 5 // moderate confidence = reasonable
    }
  }

  const rawScore = Math.round(
    Math.min(100, Math.max(0, factCoverage + signalConsistency + hypothesisDiscipline + uncertaintyDisclosure))
  )
  const score = Math.min(100, Math.max(0, rawScore))

  // Normalize label: High 75+, Medium 50–74, Low 25–49, Weak 0–24
  let label: QualityConfidenceLabel
  if (score >= 75) label = 'High'
  else if (score >= 50) label = 'Medium'
  else if (score >= 25) label = 'Low'
  else label = 'Weak'

  const explanation =
    parts.length > 0
      ? `품질 점수는 사실 coverage, 신호 일관성, 가설 절제, 불확실성 명시를 기준으로 산출됩니다. ${parts.slice(0, 3).join(', ')}.`
      : '제한된 데이터로 인해 신뢰도 평가가 어렵습니다. 추가 분석을 권합니다.'

  return { score, label, explanation }
}
