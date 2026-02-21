/**
 * Analysis Mode System for PM Strategy Console
 *
 * Defines different analysis modes with varying depth, steps, and expected outputs.
 * Used throughout the app to customize analysis behavior and UI presentation.
 */

export type AnalysisMode = 'quick' | 'deep' | 'competitive' | 'action'

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

export const ANALYSIS_MODE_STEPS: Record<AnalysisMode, AnalysisModeStep[]> = {
  quick: [
    { id: 'news', label: 'News Collection', description: '뉴스 수집' },
    { id: 'summary', label: 'Quick Summary', description: '빠른 요약' },
  ],
  deep: [
    { id: 'news', label: 'News Collection', description: '뉴스 수집' },
    { id: 'pass1', label: 'Initial Analysis', description: '1차 분석' },
    { id: 'pass2', label: 'Deep Analysis', description: '심층 분석' },
    { id: 'creative', label: 'Insight Generation', description: '인사이트 생성' },
  ],
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

export const ANALYSIS_MODE_CONFIG: Record<AnalysisMode, AnalysisModeConfig> = {
  quick: {
    id: 'quick',
    label: 'Quick Snapshot',
    labelKo: '빠른 스냅샷',
    description: 'Get a fast overview of market signals in under 30 seconds',
    descriptionKo: '30초 내 시장 신호 빠른 개요',
    steps: ANALYSIS_MODE_STEPS.quick,
    duration: '~30초',
    outputs: ['시장 요약', '핵심 신호'],
  },
  deep: {
    id: 'deep',
    label: 'Deep Strategy',
    labelKo: '심층 전략',
    description: 'Comprehensive two-pass analysis with creative insights',
    descriptionKo: '창의적 인사이트 포함 포괄적 2단계 분석',
    steps: ANALYSIS_MODE_STEPS.deep,
    duration: '~2분',
    outputs: ['시장 분석', '시장 온도', '인사이트', 'PM 액션', '모니터링 포인트'],
  },
  competitive: {
    id: 'competitive',
    label: 'Competitive Mode',
    labelKo: '경쟁 분석',
    description: 'Focus on competitor landscape and positioning',
    descriptionKo: '경쟁 환경 및 포지셔닝 집중 분석',
    steps: ANALYSIS_MODE_STEPS.competitive,
    duration: '~2분',
    outputs: ['경쟁사 동향', '시장 점유율', '차별화 포인트', '위협 요소'],
  },
  action: {
    id: 'action',
    label: 'Action-Focused',
    labelKo: '액션 중심',
    description: 'Prioritize actionable recommendations for immediate use',
    descriptionKo: '즉시 실행 가능한 추천 사항 우선',
    steps: ANALYSIS_MODE_STEPS.action,
    duration: '~1분',
    outputs: ['우선순위 액션', '리스크 경고', '다음 단계'],
  },
}

export const DEFAULT_ANALYSIS_MODE: AnalysisMode = 'deep'

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
export type StreamingState =
  | { status: 'idle' }
  | { status: 'running'; currentStep: number; totalSteps: number; stepId: string }
  | { status: 'streaming'; currentStep: number; totalSteps: number; stepId: string }
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
  stepId: string
): StreamingState {
  return {
    status: 'streaming',
    currentStep,
    totalSteps: getStepCount(mode),
    stepId,
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
