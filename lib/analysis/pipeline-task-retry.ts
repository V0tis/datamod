/**
 * 실패한 파이프라인 taskId → startStreamingResearch 옵션 (전체 새로고침 없이 API만 재호출)
 */

export function taskIdToResearchRunOptions(taskId: string | undefined): {
  force_reanalyze?: boolean
  retry_pipeline_step?: 'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity'
} {
  if (!taskId || taskId === 'done') {
    return { force_reanalyze: true }
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
      return { force_reanalyze: true }
    default:
      return { force_reanalyze: true }
  }
}
