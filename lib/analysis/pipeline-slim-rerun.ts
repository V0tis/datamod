/**
 * 슬림 파이프라인 스텝 인덱스(0–8) → /api/research/run 옵션 매핑.
 * 8(완료 메타)은 재실행 없음.
 */

export type SlimRerunKind = 'force' | 'retry'

export type SlimRerunPayload =
  | { kind: 'force' }
  | {
      kind: 'retry'
      step: 'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity'
    }

/** 재실행 불가 시 null (예: 인덱스 8) */
export function slimIndexToRerunPayload(index: number): SlimRerunPayload | null {
  if (!Number.isFinite(index) || index < 0 || index > 8) return null
  if (index === 8) return null
  if (index <= 2) return { kind: 'force' }
  if (index === 3) return { kind: 'retry', step: 'insight_extraction' }
  if (index === 4) return { kind: 'retry', step: 'strategy_generation' }
  if (index === 5) return { kind: 'retry', step: 'execution_layer' }
  if (index === 6) return { kind: 'retry', step: 'risk_opportunity' }
  if (index === 7) return { kind: 'force' }
  return null
}
