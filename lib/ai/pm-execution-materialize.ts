import type { PMActionPlanItem } from '@/lib/research-parser'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import type { Porter5ForcesShape } from '@/lib/strategy-framework-mapper'

/** PM 액션 JSON 파싱 직후 형태 (execution_layer / strategy 번들 공통). */
export type PmPlanParsedShape = {
  priority_action?: { action?: string; reasoning?: string; expected_outcome?: string }
  product_actions?: Array<{ action?: string; priority?: string; reasoning?: string }>
  feature_ideas?: string[]
  go_to_market_steps?: string[]
  steps?: string[]
  priority?: string
  goal?: string
  risk?: string
  product_idea?: string
  target_customer?: string
  monetization?: string
  pm_action_plan?: Array<{
    action_title?: string
    description?: string
    expected_outcome?: string
    estimated_timeline?: string
    priority?: string
    category?: string
  }>
  strategic_decision_layer?: {
    opportunity_score_reason_text?: string
    market_opportunity_explanation?: string
    competition_intensity?: string
    competition_explanation?: string
    product_market_fit?: string
    product_market_fit_explanation?: string
    entry_strategy?: string
    entry_explanation?: string
  }
  swot_analysis?: { strengths?: unknown[]; weaknesses?: unknown[]; opportunities?: unknown[]; threats?: unknown[] }
  jtbd?: {
    main_jobs?: unknown[]
    pains?: unknown[]
    gains?: unknown[]
    functional_jobs?: unknown[]
    social_jobs?: unknown[]
    emotional_jobs?: unknown[]
  }
  porter_5_forces?: Record<string, unknown>
  next_actions_pm?: Array<{ action?: string; why?: string; how_to_execute?: string; priority?: string; estimated_effort?: string }>
}

export type PmActionExecutionData = {
  product_actions: Array<{ action: string; priority?: string; reasoning?: string }>
  feature_ideas: string[]
  go_to_market_steps: string[]
  product_idea?: string
  target_customer?: string
  monetization?: string
  pm_action_plan?: PMActionPlanItem[]
  strategic_decision_layer?: {
    opportunity_score_reason_text?: string
    market_opportunity_explanation?: string
    competition_intensity?: 'low' | 'medium' | 'high'
    competition_explanation?: string
    product_market_fit?: 'low' | 'medium' | 'high'
    product_market_fit_explanation?: string
    entry_strategy?: string
    entry_explanation?: string
  }
  swot_analysis?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] }
  jtbd?: {
    main_jobs?: string[]
    pains?: string[]
    gains?: string[]
    functional_jobs?: string[]
    social_jobs?: string[]
    emotional_jobs?: string[]
  }
  porter_5_forces?: Porter5ForcesShape
  next_actions_pm?: Array<{ action: string; why?: string; how_to_execute?: string; priority?: 'high' | 'medium' | 'low'; estimated_effort?: string }>
}

function toStrArr(arr: unknown): string[] {
  return Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : []
}

/** parseAiJson 이후 동일 규칙으로 executionData 구성 (단독 호출·전략·실행 번들 공통). */
export function materializePmExecutionFromParsed(parsed: PmPlanParsedShape): PmActionExecutionData {
  const stepsFinal = toStrArr(parsed?.steps).slice(0, 6)
  const paFinal = parsed?.priority_action && typeof parsed.priority_action === 'object' ? parsed.priority_action : null
  const paActionFinal = paFinal && typeof paFinal.action === 'string' ? paFinal.action.trim() : ''

  let actions = Array.isArray(parsed?.product_actions)
    ? parsed.product_actions
        .filter((a): a is { action: string; priority?: string; reasoning?: string } => typeof (a as { action?: string })?.action === 'string')
        .map((a) => ({
          action: String((a as { action: string }).action),
          priority: (a as { priority?: string }).priority,
          reasoning: (a as { reasoning?: string }).reasoning,
        }))
    : []
  let pmPlan: PMActionPlanItem[] = Array.isArray(parsed?.pm_action_plan)
    ? parsed.pm_action_plan
        .map((a) => {
          const raw = a as Record<string, unknown>
          const title =
            typeof raw?.action_title === 'string' ? raw.action_title.trim() : typeof raw?.action === 'string' ? raw.action.trim() : ''
          return title ? { ...raw, action_title: title } : null
        })
        .filter((a): a is NonNullable<typeof a> => a != null)
        .map((a): PMActionPlanItem => ({
          action_title: String((a as { action_title: string }).action_title),
          description: typeof (a as Record<string, unknown>).description === 'string' ? String((a as Record<string, unknown>).description) : undefined,
          expected_outcome: typeof (a as Record<string, unknown>).expected_outcome === 'string' ? String((a as Record<string, unknown>).expected_outcome) : undefined,
          estimated_timeline:
            typeof (a as Record<string, unknown>).estimated_timeline === 'string'
              ? String((a as Record<string, unknown>).estimated_timeline).trim()
              : undefined,
          priority: (['high', 'medium', 'low'] as const).includes((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            ? ((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            : undefined,
          category: (
            ['mvp_experiment', 'user_interview', 'feature_prioritization', 'go_to_market'] as const
          ).includes((a as Record<string, unknown>).category as 'mvp_experiment' | 'user_interview' | 'feature_prioritization' | 'go_to_market')
            ? ((a as Record<string, unknown>).category as 'mvp_experiment' | 'user_interview' | 'feature_prioritization' | 'go_to_market')
            : undefined,
        }))
    : []
  if (pmPlan.length === 0 && (paActionFinal.length > 0 || stepsFinal.length > 0)) {
    if (paActionFinal) {
      pmPlan.push({
        action_title: paActionFinal,
        description: typeof paFinal?.reasoning === 'string' ? paFinal.reasoning.trim() : undefined,
        expected_outcome: typeof paFinal?.expected_outcome === 'string' ? paFinal.expected_outcome.trim() : undefined,
        priority: 'high',
      })
    }
    for (const step of stepsFinal) {
      pmPlan.push({ action_title: step, priority: 'medium' })
    }
  }
  if (actions.length === 0 && pmPlan.length > 0) {
    actions = pmPlan.map((p) => ({
      action: p.action_title,
      priority: p.priority,
      reasoning: [p.description, p.expected_outcome].filter((x): x is string => typeof x === 'string' && x.trim().length > 0).join(' — ') || undefined,
    }))
  }
  const napm = Array.isArray(parsed?.next_actions_pm)
    ? parsed.next_actions_pm
        .filter((a): a is { action: string } => typeof (a as { action?: string })?.action === 'string')
        .slice(0, 5)
        .map((a) => ({
          action: String((a as { action: string }).action).trim(),
          why: typeof (a as Record<string, unknown>).why === 'string' ? String((a as Record<string, unknown>).why).trim() : undefined,
          how_to_execute: typeof (a as Record<string, unknown>).how_to_execute === 'string' ? String((a as Record<string, unknown>).how_to_execute).trim() : undefined,
          priority: (['high', 'medium', 'low'] as const).includes((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            ? ((a as Record<string, unknown>).priority as 'high' | 'medium' | 'low')
            : undefined,
          estimated_effort: typeof (a as Record<string, unknown>).estimated_effort === 'string' ? String((a as Record<string, unknown>).estimated_effort).trim() : undefined,
        }))
    : []
  const swot =
    parsed?.swot_analysis && typeof parsed.swot_analysis === 'object'
      ? {
          strengths: toStrArr(parsed.swot_analysis.strengths),
          weaknesses: toStrArr(parsed.swot_analysis.weaknesses),
          opportunities: toStrArr(parsed.swot_analysis.opportunities),
          threats: toStrArr(parsed.swot_analysis.threats),
        }
      : undefined
  const clampPorterScore = (v: unknown): number | undefined => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(String(v), 10) : NaN
    if (!Number.isFinite(n)) return undefined
    return Math.min(5, Math.max(1, Math.round(n)))
  }
  const parsePorterFromParsed = (): Porter5ForcesShape | undefined => {
    const raw = parsed?.porter_5_forces
    if (!raw || typeof raw !== 'object') return undefined
    const o = raw as Record<string, unknown>
    const rivalry = toStrArr(o.rivalry)
    const supplier_power = toStrArr(o.supplier_power)
    const buyer_power = toStrArr(o.buyer_power)
    const substitutes = toStrArr(o.substitutes)
    const new_entrants = toStrArr(o.new_entrants)
    const sc = o.scores && typeof o.scores === 'object' ? (o.scores as Record<string, unknown>) : null
    const scores =
      sc != null
        ? {
            new_entrants: clampPorterScore(sc.new_entrants),
            supplier_power: clampPorterScore(sc.supplier_power),
            buyer_power: clampPorterScore(sc.buyer_power),
            substitutes: clampPorterScore(sc.substitutes),
            rivalry: clampPorterScore(sc.rivalry),
          }
        : undefined
    const scoresClean = scores
      ? (Object.fromEntries(Object.entries(scores).filter(([, v]) => v != null)) as Porter5ForcesShape['scores'])
      : undefined
    const hasBullets =
      rivalry.length + supplier_power.length + buyer_power.length + substitutes.length + new_entrants.length > 0
    const hasScores = scoresClean && Object.keys(scoresClean).length > 0
    if (!hasBullets && !hasScores) return undefined
    return {
      rivalry: rivalry.length ? rivalry : undefined,
      supplier_power: supplier_power.length ? supplier_power : undefined,
      buyer_power: buyer_power.length ? buyer_power : undefined,
      substitutes: substitutes.length ? substitutes : undefined,
      new_entrants: new_entrants.length ? new_entrants : undefined,
      scores: scoresClean && Object.keys(scoresClean).length > 0 ? scoresClean : undefined,
    }
  }
  const porterParsed = parsePorterFromParsed()

  const jtbdObj = parsed?.jtbd && typeof parsed.jtbd === 'object' ? parsed.jtbd : null
  const jtbdRaw = jtbdObj
    ? {
        main_jobs: toStrArr(jtbdObj.main_jobs),
        pains: toStrArr(jtbdObj.pains),
        gains: toStrArr(jtbdObj.gains),
        functional_jobs: toStrArr(jtbdObj.functional_jobs),
        social_jobs: toStrArr(jtbdObj.social_jobs),
        emotional_jobs: toStrArr(jtbdObj.emotional_jobs),
      }
    : undefined
  const jtbdFiltered =
    jtbdRaw &&
    jtbdRaw.main_jobs.length +
      jtbdRaw.pains.length +
      jtbdRaw.gains.length +
      jtbdRaw.functional_jobs.length +
      jtbdRaw.social_jobs.length +
      jtbdRaw.emotional_jobs.length >
      0
      ? jtbdRaw
      : undefined

  return {
    product_actions: actions,
    feature_ideas: toStrArr(parsed?.feature_ideas),
    go_to_market_steps: toStrArr(parsed?.go_to_market_steps),
    product_idea: typeof parsed?.product_idea === 'string' ? parsed.product_idea.trim() : undefined,
    target_customer: typeof parsed?.target_customer === 'string' ? parsed.target_customer.trim() : undefined,
    monetization: typeof parsed?.monetization === 'string' ? parsed.monetization.trim() : undefined,
    pm_action_plan: pmPlan.length > 0 ? pmPlan : undefined,
    strategic_decision_layer: (() => {
      if (!parsed?.strategic_decision_layer || typeof parsed.strategic_decision_layer !== 'object') return undefined
      const layer = { ...(parsed.strategic_decision_layer as Record<string, unknown>) }
      const a = typeof layer.opportunity_score_reason_text === 'string' ? layer.opportunity_score_reason_text.trim() : ''
      const b = typeof layer.market_opportunity_explanation === 'string' ? layer.market_opportunity_explanation.trim() : ''
      const mergedReason = sanitizeForKoreanDisplay(a || b)?.trim() || ''
      if (mergedReason.length >= 12) {
        layer.market_opportunity_explanation = mergedReason
        layer.opportunity_score_reason_text = mergedReason
      }
      return layer as PmActionExecutionData['strategic_decision_layer']
    })(),
    swot_analysis: swot,
    jtbd: jtbdFiltered,
    porter_5_forces: porterParsed,
    next_actions_pm: napm.length > 0 ? napm : undefined,
  }
}
