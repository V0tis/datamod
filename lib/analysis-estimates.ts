/**
 * Analysis depth estimates: token, cost, time by depth.
 * Used for UI (dashboard, result page, settings).
 */
export type DepthMode = 'fast' | 'standard' | 'deep'

export const DEPTH_LABELS: Record<DepthMode, string> = {
  fast: '빠른 분석',
  standard: '표준 분석',
  deep: '심층 분석',
}

/** API mode: quick = fast, standard, deep */
export function depthToApiMode(depth: DepthMode): 'quick' | 'standard' | 'deep' {
  return depth === 'fast' ? 'quick' : depth
}

export interface DepthEstimates {
  estimatedTokens: number
  estimatedCostKrw: number
  estimatedTimeSec: number
  modelLabel: string
}

const ESTIMATES: Record<DepthMode, DepthEstimates> = {
  fast: {
    estimatedTokens: 15_000,
    estimatedCostKrw: 50,
    estimatedTimeSec: 60,
    modelLabel: 'Groq (빠른 모델)',
  },
  standard: {
    estimatedTokens: 45_000,
    estimatedCostKrw: 200,
    estimatedTimeSec: 180,
    modelLabel: 'Gemini (기본)',
  },
  deep: {
    estimatedTokens: 120_000,
    estimatedCostKrw: 600,
    estimatedTimeSec: 420,
    modelLabel: 'Gemini Pro (심층)',
  },
}

export function getDepthEstimates(depth: DepthMode): DepthEstimates {
  return ESTIMATES[depth] ?? ESTIMATES.standard
}

export function formatEstimatedTime(sec: number): string {
  if (sec < 60) return '약 1분 미만'
  if (sec < 120) return '약 1~2분'
  if (sec < 300) return '약 2~5분'
  return '약 5~7분'
}
