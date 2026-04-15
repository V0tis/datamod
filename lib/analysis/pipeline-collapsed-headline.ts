import { streamTaskToStageIndex } from '@/lib/analysis/pipeline-activity-step'

const ORDERED_STEPS = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
  'risk_opportunity',
  'post_processing',
] as const

/** 접힌 바·요약용 짧은 라벨 */
export const PIPELINE_STAGE_HEADLINES = [
  '데이터 수집',
  '시장 분석',
  '경쟁 분석',
  '인사이트',
  '전략',
  '실행',
  '리스크·기회',
  '점수·차트',
] as const

/**
 * 이전 단계 완료 후 다음이 아직 시작되지 않은 큐 대기(타임라인 내부 배너와 동일 조건 근사).
 */
export function inferQueueWaitingBetweenSteps(
  pipelineInFlight: boolean,
  allCompleted: boolean,
  tasks: Array<{ step_name: string; status: string }> | null | undefined
): boolean {
  if (!pipelineInFlight || allCompleted) return false
  if (!tasks?.length) return false
  if (tasks.some((t) => t.status === 'running')) return false
  const map = Object.fromEntries(tasks.map((t) => [t.step_name, t.status]))
  for (let i = 1; i < ORDERED_STEPS.length; i++) {
    const prev = ORDERED_STEPS[i - 1]
    const cur = ORDERED_STEPS[i]
    if (map[prev] === 'completed' && (map[cur] === 'pending' || map[cur] == null)) return true
  }
  return false
}

export function getPipelineCollapsedHeadline(input: {
  allCompleted: boolean
  pipelineHasError: boolean
  hasFailedTask: boolean
  pipelineInFlight: boolean
  timelineStep: number
  streamingStepId?: string
  queueWaiting: boolean
}): { title: string; sub?: string } {
  if (input.allCompleted) return { title: '분석 완료' }
  if (input.pipelineHasError || input.hasFailedTask) {
    return { title: '분석 오류', sub: '상세 파이프라인에서 재시도할 수 있습니다.' }
  }

  let idx =
    input.timelineStep >= 0 ? Math.min(PIPELINE_STAGE_HEADLINES.length - 1, input.timelineStep) : 0
  if (input.streamingStepId) {
    const si = streamTaskToStageIndex(input.streamingStepId)
    if (si != null) idx = Math.min(PIPELINE_STAGE_HEADLINES.length - 1, si)
  }

  const label = PIPELINE_STAGE_HEADLINES[idx] ?? '분석'

  if (input.queueWaiting) {
    return { title: `${label}까지 완료` }
  }
  if (input.pipelineInFlight) {
    return { title: `${label} 진행 중…` }
  }
  return { title: '분석 준비 중…' }
}

export function getPipelineProgressPercent(input: {
  allCompleted: boolean
  timelineStep: number
  analysisTasks: Array<{ status: string }> | null | undefined
}): number {
  if (input.allCompleted) return 100
  const tasks = input.analysisTasks ?? []
  const done = tasks.filter((t) => t.status === 'completed').length
  const running = tasks.some((t) => t.status === 'running')
  let pct = Math.min(92, Math.round((done / 8) * 88))
  if (running) pct = Math.min(94, pct + 8)
  if (tasks.length === 0 && input.timelineStep >= 0) {
    pct = Math.min(85, Math.round((Math.min(7, input.timelineStep) / 7) * 72))
  }
  return Math.max(4, pct)
}
