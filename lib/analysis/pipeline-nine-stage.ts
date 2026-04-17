/**
 * dataMod 9단계 분석 파이프라인 — UI·스트림 이벤트·활동 로그 인덱스 동기화.
 * 백엔드 시퀀스: 준비 → 수집(Web/RSS) → 가공(기사) → 흐름(트렌드) → 경쟁 → 통찰 → 전략 → 액션 → 검증(+후처리).
 */

export const NINE_PIPELINE_STAGE_COUNT = 9

export type NineStageMeta = {
  id: string
  label: string
  subtitle: string
  /** 타임라인 로그 묶음용 대표 키 */
  logAnchor: string
}

export const NINE_PIPELINE_STAGES = [
  { id: 'prepare', label: '준비', subtitle: '캐시 조회 및 데이터 정합성', logAnchor: 'analysis_prep' },
  { id: 'collect', label: '수집', subtitle: '웹 컨텍스트 · RSS 시그널', logAnchor: 'signal_layer' },
  { id: 'process', label: '가공', subtitle: '핵심 기사 추출 · 요약', logAnchor: 'article_extraction' },
  { id: 'flow', label: '흐름', subtitle: '시장 트렌드 번들', logAnchor: 'trend_analysis' },
  { id: 'compete', label: '경쟁', subtitle: '경쟁사 행동 · 채택률', logAnchor: 'competition_analysis' },
  { id: 'insight', label: '통찰', subtitle: '다차원 인사이트', logAnchor: 'insight_extraction' },
  { id: 'strategy', label: '전략', subtitle: '실행 가능 전략 가설', logAnchor: 'strategy_generation' },
  { id: 'action', label: '액션', subtitle: 'PM 액션 플랜', logAnchor: 'execution_layer' },
  { id: 'validate', label: '검증', subtitle: '리스크 · 기회 타당성', logAnchor: 'risk_opportunity' },
] as const satisfies readonly NineStageMeta[]

/** 스트림/태스크 키 → 타임라인 단계 인덱스 0–8 */
export const STREAM_TO_NINE_INDEX: Record<string, number> = {
  analysis_prep: 0,
  signal_layer: 1,
  news: 1,
  article_extraction: 2,
  article_summary: 2,
  web_grounding: 1,
  trend_analysis: 3,
  pass1: 3,
  competition_analysis: 4,
  insight_extraction: 5,
  strategy_generation: 6,
  execution_layer: 7,
  pass2: 7,
  creative: 7,
  risk_opportunity: 8,
  risks_opportunities: 8,
  post_processing: 8,
  post_processing_key_metrics: 8,
  post_processing_creative: 8,
  post_processing_saving: 8,
  final_refining: 8,
  done: 8,
}

export function streamTaskToStageIndex(task: string | undefined): number | null {
  if (!task) return null
  return STREAM_TO_NINE_INDEX[task] ?? null
}

const CANONICAL_BY_INDEX = [
  'analysis_prep',
  'signal_layer',
  'article_extraction',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
  'risk_opportunity',
] as const

/** 단계별 활동 로그에 쓰는 정규화 step 키 */
export function normalizeActivityStepId(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === '__global__') return '__global__'
  const idx = streamTaskToStageIndex(raw)
  if (idx == null) return raw
  return CANONICAL_BY_INDEX[idx] ?? raw
}

/** 9단계 인덱스 → 7구간 로딩 메시지 슬롯 (Progress overlay 등) */
export const NINE_TO_PROGRESS_MESSAGE_INDEX: Record<number, number> = {
  0: 0,
  1: 0,
  2: 0,
  3: 1,
  4: 2,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
}
