/**
 * 실패한 파이프라인 taskId → startStreamingResearch 옵션.
 * - AI 후반 단계: `retry_pipeline_step`만 설정 (스냅샷으로 앞단 유지).
 * - 데이터 수집 단계: 서버가 단일 단계 재시도를 지원하지 않아 `force_reanalyze` (의도적 전체).
 * - 알 수 없는 ID·빈 값: `null` → 호출부에서 API 호출하지 말 것 (전체 재실행 방지).
 */

export type PipelineStepRetryRunOptions = {
  force_reanalyze?: boolean
  retry_pipeline_step?: 'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity'
}

export function taskIdToResearchRunOptions(
  taskId: string | undefined
): PipelineStepRetryRunOptions | null {
  if (!taskId || taskId === 'done') {
    return null
  }
  switch (taskId) {
    case 'signal_layer':
    case 'trend_analysis':
    case 'competition_analysis':
      return { force_reanalyze: true }
    case 'insight_extraction':
      return { retry_pipeline_step: 'insight_extraction' }
    case 'strategy_generation':
      return { retry_pipeline_step: 'strategy_generation' }
    case 'execution_layer':
      return { retry_pipeline_step: 'execution_layer' }
    case 'risk_opportunity':
      return { retry_pipeline_step: 'risk_opportunity' }
    case 'post_processing':
      return { retry_pipeline_step: 'risk_opportunity' }
    default:
      return null
  }
}
