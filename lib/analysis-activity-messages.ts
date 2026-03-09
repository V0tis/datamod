/**
 * Progressive AI activity messages for analysis loading states.
 * Replaces generic spinners with informative step-specific messages.
 */

const STREAM_TO_INDEX: Record<string, number> = {
  signal_layer: 0,
  news: 0,
  trend_analysis: 1,
  pass1: 1,
  competition_analysis: 2,
  strategy_generation: 3,
  execution_layer: 4,
  pass2: 4,
  creative: 4,
  done: 4,
  post_processing: 5,
  post_processing_key_metrics: 5,
  post_processing_creative: 5,
  post_processing_saving: 5,
}

/** 후처리 단계별 메시지 (파이프라인 5단계 완료 후 → done 전) */
const POST_PROCESSING_MESSAGES: Record<string, string> = {
  post_processing_key_metrics: '기회 점수·차트 산출 중...',
  post_processing_creative: 'AI 인사이트 생성 중...',
  post_processing_saving: '결과 저장 중...',
}

/** Activity messages per analysis step - shown during loading (한국어) */
export const ANALYSIS_ACTIVITY_MESSAGES: readonly string[] = [
  '시장 신호 분석 중...',
  '커뮤니티 논의 수집 중...',
  '성장 신호 감지 중...',
  '경쟁 환경 매핑 중...',
  '리스크 및 기회 평가 중...',
  '전략 인사이트 생성 중...',
  '기회 점수·차트 산출 중...',
]

/** Alternative shorter messages for compact UI */
export const ANALYSIS_ACTIVITY_SHORT: readonly string[] = [
  '신호 수집 중...',
  '트렌드 분석 중...',
  '경쟁 환경 매핑 중...',
  '리스크 평가 중...',
  '인사이트 생성 중...',
  '기회 점수·차트 산출 중...',
]

/**
 * Returns the current activity message based on step ID or step index.
 * 후처리 단계(post_processing_*)는 별도 메시지 사용.
 */
export function getAnalysisActivityMessage(
  stepId?: string | null,
  currentStep?: number,
  options?: { short?: boolean }
): string {
  if (stepId && POST_PROCESSING_MESSAGES[stepId]) {
    return POST_PROCESSING_MESSAGES[stepId]
  }
  const messages = options?.short ? ANALYSIS_ACTIVITY_SHORT : ANALYSIS_ACTIVITY_MESSAGES
  const stepIdx =
    stepId && STREAM_TO_INDEX[stepId] != null
      ? STREAM_TO_INDEX[stepId]
      : typeof currentStep === 'number' && currentStep >= 0
        ? currentStep
        : 0
  const idx = Math.min(Math.max(0, stepIdx), messages.length - 1)
  return messages[idx] ?? messages[0]
}
