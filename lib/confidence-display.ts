/**
 * Confidence display: map existing metadata (or heuristics) to qualitative
 * labels and short rationale. No analysis logic changes; UI-only for PM decision transparency.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface ConfidenceDisplay {
  level: ConfidenceLevel
  label: string
  rationale: string
}

/** Thresholds for numeric confidence (0–100) → qualitative level. */
const HIGH_MIN = 70
const MEDIUM_MIN = 40

export interface ConfidenceContext {
  /** True when only one AI engine was used (e.g. partial data). */
  partialData?: boolean
  hasSummary?: boolean
  actionItemsCount?: number
}

/**
 * Derive qualitative confidence and rationale from numeric metadata or context.
 * Avoids showing percentages; gives PMs a clear "how much to rely on this" signal.
 */
export function getConfidenceDisplay(
  confidenceValue: number | null | undefined,
  context?: ConfidenceContext
): ConfidenceDisplay | null {
  const partial = context?.partialData === true

  // When we have a numeric confidence from consensus, map to level + rationale
  if (typeof confidenceValue === 'number' && Number.isFinite(confidenceValue)) {
    const c = Math.max(0, Math.min(100, confidenceValue))
    if (c >= HIGH_MIN) {
      return {
        level: 'high',
        label: '높음',
        rationale: '두 AI 의견이 잘 맞아 통찰에 높은 확신을 둘 수 있습니다.',
      }
    }
    if (c >= MEDIUM_MIN) {
      return {
        level: 'medium',
        label: '보통',
        rationale: '일부 지표에서 의견이 달라 참고용으로 활용하세요.',
      }
    }
    return {
      level: 'low',
      label: '낮음',
      rationale: '근거가 제한적이므로 추가 확인을 권합니다.',
    }
  }

  // No numeric confidence: derive from context (heuristic for display only)
  if (partial) {
    return {
      level: 'low',
      label: '낮음',
      rationale: '한쪽 AI 결과만 반영되어 참고용으로 활용하세요.',
    }
  }
  if (context?.hasSummary) {
    return {
      level: 'medium',
      label: '보통',
      rationale: '두 엔진 결과를 종합했습니다. 참고용으로 활용하세요.',
    }
  }

  return null
}
