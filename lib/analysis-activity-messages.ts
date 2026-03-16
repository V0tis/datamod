/**
 * Progressive AI activity messages for analysis loading states.
 * 7-step progress UX: 데이터 수집 → 시장 리서치 → 경쟁사 분석 → 인사이트 추출 → 전략 추천 → PM 액션 플랜 → 리스크 및 기회 평가.
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
  risk_opportunity: 6,
  risks_opportunities: 6,
  done: 7,
  post_processing: 7,
  post_processing_key_metrics: 7,
  post_processing_creative: 7,
  post_processing_saving: 7,
}

/** 7-step progress for loading UX - user-facing analysis stages */
export const PROGRESS_STEPS = [
  { id: 0, label: 'Data collection', labelKo: '데이터 수집', messageKo: '뉴스, 트렌드, 시장 신호를 수집하고 있습니다', dynamicMessages: ['뉴스 기사 검색 중...', '트렌드 데이터 수집 중...', '시장 신호 수집 중...'], longStepMessage: '데이터 수집이 완료되면 바로 다음 단계로 넘어갑니다.' },
  { id: 1, label: 'Market research', labelKo: '시장 리서치', messageKo: '시장 성장 신호와 트렌드를 분석하고 있습니다', dynamicMessages: ['시장 성장 패턴 분석 중...', '신흥 트렌드 식별 중...', '시장 규모 추정 중...'], longStepMessage: 'AI가 시장 리서치를 진행 중입니다.' },
  { id: 2, label: 'Competitor analysis', labelKo: '경쟁사 분석', messageKo: '경쟁 환경과 주요 경쟁사를 분석하고 있습니다', dynamicMessages: ['경쟁사 목록 식별 중...', '경쟁 지형도 작성 중...', '경쟁 포지셔닝 분석 중...'], longStepMessage: 'AI가 경쟁사를 분석하는 중입니다.' },
  { id: 3, label: 'Insight extraction', labelKo: '인사이트 추출', messageKo: '핵심 인사이트와 시장 신호를 도출하고 있습니다', dynamicMessages: ['핵심 시그널 추출 중...', '리스크·기회 식별 중...', '시장 인사이트 정리 중...'], longStepMessage: 'AI가 인사이트를 추출하는 중입니다.' },
  { id: 4, label: 'Strategy recommendation', labelKo: '전략 추천', messageKo: '리스크를 평가하고 전략 방향을 도출하고 있습니다', dynamicMessages: ['리스크 평가 중...', '전략 방향 도출 중...', '차별화 포인트 분석 중...'], longStepMessage: 'AI가 전략을 생성하는 중입니다.' },
  { id: 5, label: 'PM action plan', labelKo: 'PM 액션 플랜 생성', messageKo: '제품 전략과 실행 액션을 도출하고 있습니다', dynamicMessages: ['PM 액션 도출 중...', '우선순위 정렬 중...', '실행 플랜 정리 중...'], longStepMessage: 'AI가 PM 액션 플랜을 생성하는 중입니다.' },
  { id: 6, label: 'Risk & opportunity evaluation', labelKo: '리스크 및 기회 평가', messageKo: '기회 점수와 차트를 산출하고 있습니다', dynamicMessages: ['기회 점수 산출 중...', '차트 데이터 생성 중...', '결과 저장 중...'], longStepMessage: 'AI가 리스크 및 기회를 평가하는 중입니다.' },
] as const

/** Estimated seconds per step for ETA (step 0-6). Total ~90-150 sec */
export const STEP_ETA_SECONDS = [20, 18, 20, 18, 22, 25, 20] as const

/** Seconds after which to show long-step message (e.g. "AI가 전략을 생성하는 중입니다...") */
export const LONG_STEP_THRESHOLD_SEC = 8

/** Map pipeline step index (0–7) to 7-step progress index (0–6). Step 6 = risk_opportunity, 7 = post_processing. */
export const PIPELINE_TO_PROGRESS_INDEX: Record<number, number> = {
  0: 0, // signal_layer, news
  1: 1, // trend_analysis
  2: 2, // competition_analysis
  3: 3, // insight_extraction
  4: 4, // strategy_generation
  5: 5, // execution_layer, creative
  6: 6, // risk_opportunity
  7: 6, // post_processing (same UX message as step 6: 기회 점수·차트)
}

/** 후처리 단계별 메시지 (리스크·기회 평가 → 기회점수·차트 산출) */
const POST_PROCESSING_MESSAGES: Record<string, string> = {
  post_processing_key_metrics: '기회 점수·차트 산출 중...',
  post_processing_creative: 'AI 인사이트 생성 중...',
  post_processing_saving: '결과 저장 중...',
}

/** Activity messages per analysis step - shown during loading (한국어) */
export const ANALYSIS_ACTIVITY_MESSAGES: readonly string[] = [
  '시장 신호 수집 중...',
  '시장 리서치 진행 중...',
  '경쟁사 분석 중...',
  '인사이트 추출 중...',
  '전략 추천 생성 중...',
  'PM 액션 플랜 생성 중...',
  '리스크 및 기회 평가 중...',
]

/** Alternative shorter messages for compact UI */
export const ANALYSIS_ACTIVITY_SHORT: readonly string[] = [
  '데이터 수집 중...',
  '시장 리서치 중...',
  '경쟁사 분석 중...',
  '인사이트 추출 중...',
  '전략 생성 중...',
  'PM 액션 플랜 중...',
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
  const mapped = PIPELINE_TO_PROGRESS_INDEX[Math.min(idx, 6)]
  return mapped != null ? mapped : Math.min(idx, PROGRESS_STEPS.length - 1)
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
 * Returns the long-step message when a step takes longer than LONG_STEP_THRESHOLD_SEC.
 * E.g. "AI가 전략을 생성하는 중입니다..."
 */
export function getLongStepMessage(stepIndex: number): string {
  const step = PROGRESS_STEPS[stepIndex]
  return step && 'longStepMessage' in step && typeof step.longStepMessage === 'string'
    ? step.longStepMessage
    : 'AI가 분석을 진행 중입니다.'
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
 * When elapsedMs >= LONG_STEP_THRESHOLD_SEC * 1000, returns long-step message for reassurance.
 */
export function getAnalysisActivityMessage(
  stepId?: string | null,
  currentStep?: number,
  options?: { short?: boolean; elapsedMs?: number }
): string {
  const stepIdx =
    stepId && STREAM_TO_INDEX[stepId] != null
      ? STREAM_TO_INDEX[stepId]
      : typeof currentStep === 'number' && currentStep >= 0
        ? currentStep
        : 0
  const progressIndex = PIPELINE_TO_PROGRESS_INDEX[Math.min(stepIdx, 6)] ?? Math.min(stepIdx, PROGRESS_STEPS.length - 1)
  if (options?.elapsedMs != null && options.elapsedMs >= LONG_STEP_THRESHOLD_SEC * 1000) {
    return getLongStepMessage(progressIndex)
  }
  if (stepId && POST_PROCESSING_MESSAGES[stepId]) {
    return POST_PROCESSING_MESSAGES[stepId]
  }
  const messages = options?.short ? ANALYSIS_ACTIVITY_SHORT : ANALYSIS_ACTIVITY_MESSAGES
  const idx = Math.min(Math.max(0, progressIndex), messages.length - 1)
  return messages[idx] ?? messages[0]
}
