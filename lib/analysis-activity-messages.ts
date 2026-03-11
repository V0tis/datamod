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
  insight_extraction: 3,
  strategy_generation: 4,
  execution_layer: 5,
  pass2: 5,
  creative: 5,
  done: 5,
  post_processing: 6,
  post_processing_key_metrics: 6,
  post_processing_creative: 6,
  post_processing_saving: 6,
}

/** 4-step progress for loading UX: step index 0–3 maps to user-facing stages */
export const PROGRESS_STEPS = [
  { id: 0, label: 'Collecting market data', labelKo: '시장 데이터 수집', messageKo: '뉴스, 트렌드, 시장 신호를 수집하고 있습니다' },
  { id: 1, label: 'Analyzing competitors', labelKo: '경쟁사 분석', messageKo: '경쟁 환경과 주요 경쟁사를 분석하고 있습니다' },
  { id: 2, label: 'Generating strategic insights', labelKo: '전략 인사이트 생성', messageKo: '리스크와 기회를 평가하고 전략 인사이트를 도출합니다' },
  { id: 3, label: 'Building action plan', labelKo: '액션 플랜 작성', messageKo: '제품 전략과 실행 액션을 도출하고 있습니다' },
] as const

/** Map pipeline step index (0–6) to 4-step progress index (0–3) */
export const PIPELINE_TO_PROGRESS_INDEX: Record<number, number> = {
  0: 0, // signal_layer, news
  1: 0, // trend_analysis, pass1
  2: 1, // competition_analysis
  3: 1, // insight_extraction
  4: 2, // strategy_generation
  5: 3, // execution_layer, pass2, creative
  6: 3, // post_processing
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
 * Returns the current progress step index (0–3) for the 4-step loading UX.
 */
export function getProgressStepIndex(stepId?: string | null, pipelineIndex?: number): number {
  const idx = stepId && STREAM_TO_INDEX[stepId] != null
    ? STREAM_TO_INDEX[stepId]
    : typeof pipelineIndex === 'number' && pipelineIndex >= 0
      ? pipelineIndex
      : 0
  return PIPELINE_TO_PROGRESS_INDEX[Math.min(idx, 6)] ?? 0
}

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
