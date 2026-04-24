/**
 * 분석 모드(빠른·표준·심층) — 기획서와 동일: 의사결정 상황에 따라 분석 깊이가 달라 한 가지 방식만으로는 유연한 대응이 어려워 세 가지 타입을 둡니다.
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
  /** PM용 한 줄 가치 제안(모드 선택 카드) */
  taglineKo: string
  /** 활용 시나리오(비즈니스 카피) */
  purposeKo: string
  /** 카드/배지용 짧은 키 */
  qualityBadgeShortKo: string
  steps: AnalysisModeStep[]
  duration: string
  outputs: string[]
}

/** Product Strategy Engine — 5 layers (내부 파이프라인) */
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
  standard: '트렌드·경쟁·리스크를 밸런스 있게 — 비즈니스 의사결정에 쓰는 핵심을 균형 있게',
  quick: '본격 기획 전, 왜 트렌드인지·가치 있는 시장인지 빠르게 확인',
  deep: '사업 진입·피벗·가격 모델 등 실패 비용이 큰 결정 전, 근거로 리스크 검증',
  competitive: '경쟁사 포지셔닝과 차별화',
  action: '실행 가능한 액션 플랜',
}

export const ANALYSIS_MODE_CONFIG: Record<AnalysisMode, AnalysisModeConfig> = {
  standard: {
    id: 'standard',
    label: 'Standard Analysis',
    labelKo: '표준 분석',
    description: 'Full analysis pipeline – market structure, signals, actions',
    descriptionKo: '트렌드 흐름·경쟁사 현황·잠재적 리스크 등을 밸런스 있게 분석',
    taglineKo: '트렌드 흐름·경쟁사 현황·잠재적 리스크를 밸런스 있게',
    purposeKo:
      '비즈니스 의사결정에 필수적인 핵심 요소들을 밸런스 있게 분석할 때 사용합니다.',
    qualityBadgeShortKo: 'Standard',
    steps: ANALYSIS_MODE_STEPS.standard,
    duration: '~2분',
    outputs: ['시장 점수', '시그널', '경쟁 환경', '전략 액션', '리포트'],
  },
  quick: {
    id: 'quick',
    label: 'Fast Analysis',
    labelKo: '빠른 분석',
    description: 'Short summary and key signals',
    descriptionKo: '트렌드인 이유·시장 가치를 빠르게 확인',
    taglineKo: '왜 트렌드인지, 가치 있는 시장인지 빠르게 확인',
    purposeKo:
      '본격적인 기획 하기 전, 왜 트렌드인지·가치가 있는 시장인지 빠르게 확인할 때 사용합니다.',
    qualityBadgeShortKo: 'Fast',
    steps: ANALYSIS_MODE_STEPS.quick,
    duration: '~30초',
    outputs: ['시장 요약', '핵심 신호'],
  },
  deep: {
    id: 'deep',
    label: 'Deep Analysis',
    labelKo: '심층 분석',
    description: 'Extended analysis with more data sources and detailed insights',
    descriptionKo: '실패 비용이 큰 결정 전, 근거로 리스크 검증',
    taglineKo: '사업 진입·피벗·가격 모델 등, 실패 비용이 큰 결정 전 리스크 검증',
    purposeKo:
      '신규 사업 진입·피벗·가격 모델 변경 등 실패 비용이 큰 결정을 내리기 전, 더 많은 근거로 리스크를 검증할 때 사용합니다.',
    qualityBadgeShortKo: 'Deep',
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
    taglineKo: '경쟁 지형과 포지셔닝에 초점',
    purposeKo: '빅테크·로컬 강자 대비 전술·포지셔닝을 세부적으로 볼 때.',
    qualityBadgeShortKo: 'Competitive',
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
    taglineKo: '다음 주 실행에 바로 쓰는 액션 플랜',
    purposeKo: '백로그·캡럽 정리, 분기 OKR에 연결할 실행 항목이 우선일 때.',
    qualityBadgeShortKo: 'Action',
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
