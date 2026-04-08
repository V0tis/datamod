/**
 * Analysis Mode System for PM Strategy Console
 *
 * Defines different analysis modes with varying depth, steps, and expected outputs.
 * Used throughout the app to customize analysis behavior and UI presentation.
 */

export type AnalysisMode = 'standard' | 'quick' | 'deep' | 'competitive' | 'action'

export type AnalysisModeStep = {
  id: string
  label: string
  description: string
}

export type AnalysisModeConfig = {
  id: AnalysisMode
  label: string
  labelKo: string
  description: string
  descriptionKo: string
  steps: AnalysisModeStep[]
  duration: string
  outputs: string[]
}

/** Product Strategy Engine - 5 layers */
export const ENGINE_STAGE_IDS = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'strategy_generation',
  'execution_layer',
] as const

/** Engine step IDs used by runResearch streaming - all depth modes share these for compatibility */
const SHARED_ENGINE_STEPS: AnalysisModeStep[] = [
  { id: 'signal_layer', label: '시장 신호 수집', description: '검색 트렌드, 뉴스, 스타트업 런칭, 펀딩 신호 수집' },
  { id: 'trend_analysis', label: '시장 성장 신호 분석', description: '성장 패턴·신흥 트렌드 식별' },
  { id: 'competition_analysis', label: '경쟁 환경 매핑', description: '경쟁사 식별·경쟁 지형도 작성' },
  { id: 'strategy_generation', label: '시장 리스크 평가', description: '포화, 강자, 하락 신호 평가' },
  { id: 'execution_layer', label: '제품 전략 도출', description: '시장 신호·분석 기반 제품 전략 생성' },
]

export const ANALYSIS_MODE_STEPS: Record<AnalysisMode, AnalysisModeStep[]> = {
  standard: SHARED_ENGINE_STEPS,
  quick: SHARED_ENGINE_STEPS,
  deep: SHARED_ENGINE_STEPS,
  competitive: [
    { id: 'news', label: 'News Collection', description: '뉴스 수집' },
    { id: 'competitor', label: 'Competitor Scan', description: '경쟁사 스캔' },
    { id: 'analysis', label: 'Comparative Analysis', description: '비교 분석' },
    { id: 'insights', label: 'Strategic Insights', description: '전략 인사이트' },
  ],
  action: [
    { id: 'news', label: 'News Collection', description: '뉴스 수집' },
    { id: 'analysis', label: 'Action Analysis', description: '액션 분석' },
    { id: 'recommendations', label: 'Action Items', description: '액션 아이템' },
  ],
}

/** Hover tooltip descriptions for PM clarity */
export const ANALYSIS_MODE_TOOLTIPS: Record<AnalysisMode, string> = {
  standard: '전체 분석 파이프라인 실행 (추천)',
  quick: '5분 내 시장 신호 개요',
  deep: '시장 구조, 리스크, 전략 방향',
  competitive: '경쟁사 포지셔닝과 차별화',
  action: '실행 가능한 액션 플랜',
}

export const ANALYSIS_MODE_CONFIG: Record<AnalysisMode, AnalysisModeConfig> = {
  standard: {
    id: 'standard',
    label: 'Standard Analysis',
    labelKo: '표준 분석',
    description: 'Full analysis pipeline – market structure, signals, actions',
    descriptionKo: '전체 분석 파이프라인 실행',
    steps: ANALYSIS_MODE_STEPS.standard,
    duration: '~2분',
    outputs: ['시장 점수', '시그널', '경쟁 환경', '전략 액션', '리포트'],
  },
  quick: {
    id: 'quick',
    label: 'Quick Insight',
    labelKo: '빠른 인사이트',
    description: 'Short summary and key signals',
    descriptionKo: '짧은 요약과 핵심 시그널',
    steps: ANALYSIS_MODE_STEPS.quick,
    duration: '~30초',
    outputs: ['시장 요약', '핵심 신호'],
  },
  deep: {
    id: 'deep',
    label: 'Deep Research',
    labelKo: '심층 리서치',
    description: 'Extended analysis with more data sources and detailed insights',
    descriptionKo: '더 많은 데이터 소스와 상세 인사이트 포함',
    steps: ANALYSIS_MODE_STEPS.deep,
    duration: '~2분',
    outputs: ['시장 분석', '시장 온도', '인사이트', 'PM 액션', '모니터링 포인트'],
  },
  competitive: {
    id: 'competitive',
    label: 'Competitive Mode',
    labelKo: '경쟁 분석',
    description: 'Competitor positioning and differentiation',
    descriptionKo: '경쟁사 포지셔닝과 차별화',
    steps: ANALYSIS_MODE_STEPS.competitive,
    duration: '~2분',
    outputs: ['경쟁사 동향', '시장 점유율', '차별화 포인트', '위협 요소'],
  },
  action: {
    id: 'action',
    label: 'Action-Focused',
    labelKo: '액션 중심',
    description: 'Execution-ready action plan',
    descriptionKo: '실행 가능한 액션 플랜',
    steps: ANALYSIS_MODE_STEPS.action,
    duration: '~1분',
    outputs: ['우선순위 액션', '리스크 경고', '다음 단계'],
  },
}

export const DEFAULT_ANALYSIS_MODE: AnalysisMode = 'standard'

export function getAnalysisModeConfig(mode: AnalysisMode): AnalysisModeConfig {
  return ANALYSIS_MODE_CONFIG[mode]
}

export function getStepCount(mode: AnalysisMode): number {
  return ANALYSIS_MODE_STEPS[mode].length
}

export function getStepByIndex(mode: AnalysisMode, index: number): AnalysisModeStep | null {
  const steps = ANALYSIS_MODE_STEPS[mode]
  return index >= 0 && index < steps.length ? steps[index] : null
}

export function getStepIndex(mode: AnalysisMode, stepId: string): number {
  return ANALYSIS_MODE_STEPS[mode].findIndex((s) => s.id === stepId)
}

/**
 * Explicit streaming state machine for analysis progress.
 * This replaces the implicit status derived from job polling.
 */
/** runResearch 스트림에서 전달되는 진행 상세(건수·시각·출처) */
export type AnalysisProgressMeta = {
  newsCount?: number
  collectedAt?: string
  dataPointCount?: number
  sourceLabel?: string
  /** 최종 정제 구간( final_refining ) — 1~3 */
  refiningPhase?: 1 | 2 | 3
  refiningMessage?: string
}

export type StreamingState =
  | { status: 'idle' }
  | {
      status: 'running'
      currentStep: number
      totalSteps: number
      stepId: string
      retryMessage?: string
      currentArticleTitle?: string
      progressMeta?: AnalysisProgressMeta
    }
  | {
      status: 'streaming'
      currentStep: number
      totalSteps: number
      stepId: string
      retryMessage?: string
      currentArticleTitle?: string
      progressMeta?: AnalysisProgressMeta
    }
  | { status: 'completed'; reportId: string | null }
  | { status: 'error'; message: string; lastSuccessfulStep: number | null }

export type StreamingStatus = StreamingState['status']

export function createIdleState(): StreamingState {
  return { status: 'idle' }
}

export function createRunningState(
  mode: AnalysisMode,
  currentStep: number,
  stepId: string
): StreamingState {
  return {
    status: 'running',
    currentStep,
    totalSteps: getStepCount(mode),
    stepId,
  }
}

export function createStreamingState(
  mode: AnalysisMode,
  currentStep: number,
  stepId: string,
  retryMessage?: string,
  currentArticleTitle?: string,
  progressMeta?: AnalysisProgressMeta
): StreamingState {
  return {
    status: 'streaming',
    currentStep,
    totalSteps: getStepCount(mode),
    stepId,
    ...(retryMessage ? { retryMessage } : {}),
    ...(currentArticleTitle ? { currentArticleTitle } : {}),
    ...(progressMeta && Object.keys(progressMeta).length > 0 ? { progressMeta } : {}),
  }
}

export function createCompletedState(reportId: string | null): StreamingState {
  return { status: 'completed', reportId }
}

export function createErrorState(
  message: string,
  lastSuccessfulStep: number | null
): StreamingState {
  return { status: 'error', message, lastSuccessfulStep }
}

export function isAnalyzing(state: StreamingState): boolean {
  return state.status === 'running' || state.status === 'streaming'
}

export function isTerminal(state: StreamingState): boolean {
  return state.status === 'completed' || state.status === 'error'
}
