/**
 * Progressive AI activity messages for analysis loading states.
 * 5-step progress UX: Collecting market data → Analyzing competitors → Extracting insights → Generating strategy → Building action plan.
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

/** 5-step progress for loading UX - user-facing analysis stages */
export const PROGRESS_STEPS = [
  { id: 0, label: 'Collecting market data', labelKo: '시장 데이터 수집', messageKo: '뉴스, 트렌드, 시장 신호를 수집하고 있습니다', dynamicMessages: ['뉴스 기사 검색 중...', '트렌드 데이터 수집 중...', '시장 신호 수집 중...'] },
  { id: 1, label: 'Analyzing competitors', labelKo: '경쟁사 분석', messageKo: '경쟁 환경과 주요 경쟁사를 분석하고 있습니다', dynamicMessages: ['경쟁사 목록 식별 중...', '경쟁 지형도 작성 중...', '경쟁 포지셔닝 분석 중...'] },
  { id: 2, label: 'Extracting insights', labelKo: '인사이트 추출', messageKo: '핵심 인사이트와 시장 신호를 도출하고 있습니다', dynamicMessages: ['핵심 시그널 추출 중...', '리스크·기회 식별 중...', '시장 인사이트 정리 중...'] },
  { id: 3, label: 'Generating strategy', labelKo: '전략 생성', messageKo: '리스크를 평가하고 전략 방향을 도출하고 있습니다', dynamicMessages: ['리스크 평가 중...', '전략 방향 도출 중...', '차별화 포인트 분석 중...'] },
  { id: 4, label: 'Building action plan', labelKo: '액션 플랜 작성', messageKo: '제품 전략과 실행 액션을 도출하고 있습니다', dynamicMessages: ['PM 액션 도출 중...', '우선순위 정렬 중...', '실행 플랜 정리 중...'] },
] as const

/** Estimated seconds per step for ETA (step 0-4). Total ~90-120 sec */
export const STEP_ETA_SECONDS = [25, 22, 20, 18, 15] as const

/** Map pipeline step index (0–6) to 5-step progress index (0–4) */
export const PIPELINE_TO_PROGRESS_INDEX: Record<number, number> = {
  0: 0, // signal_layer, news
  1: 0, // trend_analysis, pass1
  2: 1, // competition_analysis
  3: 2, // insight_extraction
  4: 3, // strategy_generation
  5: 4, // execution_layer, pass2, creative
  6: 4, // post_processing
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
 * Returns the current progress step index (0–4) for the 5-step loading UX.
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
 * Returns estimated remaining seconds based on current step index.
 */
export function getEstimatedRemainingSeconds(stepIndex: number): number {
  let remaining = 0
  for (let i = stepIndex; i < STEP_ETA_SECONDS.length; i++) {
    remaining += STEP_ETA_SECONDS[i]
  }
  return Math.max(0, remaining)
}

/**
 * Returns a rotating dynamic message for the current step (for "what AI is doing").
 * Use stepStartTime to cycle through dynamicMessages every few seconds.
 */
export function getDynamicStepMessage(
  stepIndex: number,
  stepStartTime?: number
): string {
  const step = PROGRESS_STEPS[stepIndex]
  if (!step || !('dynamicMessages' in step) || !Array.isArray(step.dynamicMessages)) {
    return step?.messageKo ?? '분석 중...'
  }
  const msgs = step.dynamicMessages as readonly string[]
  if (msgs.length === 0) return step.messageKo
  const cycleMs = 4000
  const elapsed = stepStartTime != null ? Date.now() - stepStartTime : 0
  const idx = Math.min(Math.floor(elapsed / cycleMs), msgs.length - 1)
  return msgs[idx]
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
