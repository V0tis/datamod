/**
 * 스트리밍/태스크 키 → 타임라인 단계 인덱스(0–8). 9단계 파이프라인 정의는 pipeline-nine-stage.
 */
export {
  streamTaskToStageIndex,
  normalizeActivityStepId,
  NINE_PIPELINE_STAGE_COUNT,
  NINE_PIPELINE_STAGES,
  STREAM_TO_NINE_INDEX,
  NINE_TO_PROGRESS_MESSAGE_INDEX,
} from '@/lib/analysis/pipeline-nine-stage'
