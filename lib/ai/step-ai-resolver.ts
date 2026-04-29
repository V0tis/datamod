import type { AIPrimaryModel } from '@/lib/research-keys'

export type AIStepName =
  | 'market'
  | 'competitor'
  | 'insight'
  | 'strategy'
  | 'action'
  | 'risk'
  | 'creative'
  | 'consensus'

export interface StepAISettings {
  ai_primary_model: AIPrimaryModel
  ai_market_model?: string | null
  ai_competitor_model?: string | null
  ai_insight_model?: string | null
  ai_strategy_model?: string | null
  ai_action_model?: string | null
  ai_risk_model?: string | null
  ai_creative_model?: string | null
  ai_consensus_model?: string | null
}

const STEP_COLUMN_MAP: Record<AIStepName, keyof StepAISettings> = {
  market: 'ai_market_model',
  competitor: 'ai_competitor_model',
  insight: 'ai_insight_model',
  strategy: 'ai_strategy_model',
  action: 'ai_action_model',
  risk: 'ai_risk_model',
  creative: 'ai_creative_model',
  consensus: 'ai_consensus_model',
}

export const AI_STEP_LABELS: Record<AIStepName, string> = {
  market: '시장 리서치',
  competitor: '경쟁 분석',
  insight: '인사이트 추출',
  strategy: '전략 생성',
  action: 'PM 액션 플랜',
  risk: '리스크 분석',
  creative: 'Creative 분석',
  consensus: 'Consensus 종합',
}

export const ALL_AI_STEPS: AIStepName[] = [
  'market',
  'competitor',
  'insight',
  'strategy',
  'action',
  'risk',
  'creative',
  'consensus',
]

/**
 * Resolve which AI provider to use for a given analysis step.
 * Fallback chain: step-specific column → ai_primary_model → 'gemini'
 * Always returns a valid value; never undefined.
 */
export function resolveAIForStep(
  settings: StepAISettings | null | undefined,
  step: AIStepName,
): AIPrimaryModel {
  if (!settings) return 'gemini'
  const primary = settings.ai_primary_model === 'groq' ? 'groq' : 'gemini'
  const col = STEP_COLUMN_MAP[step]
  const stepValue = settings[col]
  const resolved: AIPrimaryModel =
    stepValue === 'gemini' || stepValue === 'groq'
      ? stepValue
      : primary
  return resolved
}

/** Build StepAISettings from a flat DB row (used by API routes). Ensures ai_primary_model is always valid. */
export function buildStepAISettings(row: Record<string, unknown> | null): StepAISettings {
  const raw = row?.ai_primary_model as string | undefined
  const primary: AIPrimaryModel = raw === 'groq' ? 'groq' : 'gemini'
  return {
    ai_primary_model: primary,
    ai_market_model: row?.ai_market_model as string | null ?? null,
    ai_competitor_model: row?.ai_competitor_model as string | null ?? null,
    ai_insight_model: row?.ai_insight_model as string | null ?? null,
    ai_strategy_model: row?.ai_strategy_model as string | null ?? null,
    ai_action_model: row?.ai_action_model as string | null ?? null,
    ai_risk_model: row?.ai_risk_model as string | null ?? null,
    ai_creative_model: row?.ai_creative_model as string | null ?? null,
    ai_consensus_model: row?.ai_consensus_model as string | null ?? null,
  }
}
