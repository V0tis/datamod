/**
 * Shared pipeline stage status for slim stepper (9단계, StrategyEnginePipeline과 동기).
 */

import { streamTaskToStageIndex, STREAM_TO_NINE_INDEX } from '@/lib/analysis/pipeline-nine-stage'
import { getPhase2CompetitionRowStatus, getPhase2TrendRowStatus } from '@/lib/analysis/phase2-row-status'
import type { ResearchResponse } from '@/lib/stores/research-store'

const STREAM_TO_INDEX = STREAM_TO_NINE_INDEX

const PIPELINE_STAGE_META = [
  { taskId: '__prep__' as const },
  { taskId: 'signal_layer' as const },
  { taskId: 'article_extraction' as const },
  { taskId: 'trend_analysis' as const },
  { taskId: 'competition_analysis' as const },
  { taskId: 'insight_extraction' as const },
  { taskId: 'strategy_generation' as const },
  { taskId: 'execution_layer' as const },
  { taskId: 'risk_opportunity' as const },
] as const

export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed'

export type PipelineSlimStatusContext = {
  analysisTasks: Array<{ step_name: string; status: string }> | null | undefined
  streamingStepId?: string | undefined
  currentStep: number
  allCompleted: boolean
  hasError: boolean
  errorStepIndex: number
  result: ResearchResponse | null | undefined
}

export function computeEffectivePipelineIndex(
  allCompleted: boolean,
  streamingStepId: string | undefined,
  currentStep: number,
  analysisTasks?: Array<{ step_name: string; status: string }> | null
): number {
  if (allCompleted) return 8
  if (streamingStepId === 'competition_analysis' && analysisTasks?.length) {
    const tr = analysisTasks.find((t) => t.step_name === 'trend_analysis')
    if (tr?.status !== 'completed') return 3
    return 4
  }
  if (streamingStepId && STREAM_TO_INDEX[streamingStepId] != null) {
    return STREAM_TO_INDEX[streamingStepId]
  }
  return currentStep >= 0 ? currentStep : 0
}

export function getPipelineSlimStageStatuses(ctx: PipelineSlimStatusContext): PipelineStageStatus[] {
  const {
    analysisTasks,
    streamingStepId,
    currentStep,
    allCompleted,
    hasError,
    errorStepIndex,
    result,
  } = ctx

  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => {
      acc[t.step_name] = t
      return acc
    },
    {} as Record<string, { status: string }>
  )

  const effectiveIndex = computeEffectivePipelineIndex(allCompleted, streamingStepId, currentStep, analysisTasks)
  const failIdx = hasError ? Math.min(errorStepIndex, 8) : -1

  const sig = taskMap['signal_layer']
  const artEx = taskMap['article_extraction']
  const artSum = taskMap['article_summary']

  const out: PipelineStageStatus[] = []

  for (let i = 0; i < PIPELINE_STAGE_META.length; i++) {
    const stage = PIPELINE_STAGE_META[i]
    const taskId = stage.taskId
    const task =
      taskId === '__prep__'
        ? null
        : taskId === 'article_extraction'
          ? artEx ?? artSum
          : taskMap[taskId]

    let status: PipelineStageStatus

    if (hasError && failIdx >= 0 && i === failIdx) {
      status = 'failed'
    } else if (taskId === '__prep__') {
      if (!sig) status = allCompleted || effectiveIndex > 0 ? 'completed' : 'pending'
      else if (sig.status === 'pending') status = 'running'
      else status = 'completed'
    } else if (taskId === 'trend_analysis') {
      status = getPhase2TrendRowStatus(taskMap['trend_analysis'])
    } else if (taskId === 'competition_analysis') {
      status = getPhase2CompetitionRowStatus(taskMap['trend_analysis'], taskMap['competition_analysis'])
    } else if (
      taskId === 'article_extraction' &&
      (streamingStepId === 'article_extraction' ||
        streamingStepId === 'article_summary' ||
        artEx?.status === 'running' ||
        artSum?.status === 'running')
    ) {
      status = 'running'
    } else if (task && task.status) {
      if (task.status === 'failed') status = 'failed'
      else if (task.status === 'completed') status = 'completed'
      else if (task.status === 'running') status = 'running'
      else status = 'pending'
    } else if (taskId === 'risk_opportunity') {
      const riskTask = taskMap['risk_opportunity']
      if (riskTask) {
        if (riskTask.status === 'failed') status = 'failed'
        else if (riskTask.status === 'completed') status = 'completed'
        else if (riskTask.status === 'running') status = 'running'
        else status = 'pending'
      } else if (
        result?.key_metrics != null &&
        typeof (result.key_metrics as { opportunity_score?: unknown }).opportunity_score === 'number'
      ) {
        status = 'completed'
      } else {
        const isPostProcessing =
          streamingStepId &&
          (streamingStepId.startsWith('post_processing_') ||
            streamingStepId === 'post_processing' ||
            streamingStepId === 'final_refining')
        status = allCompleted ? 'completed' : isPostProcessing ? 'running' : 'pending'
      }
    } else if (hasError && failIdx >= 0) {
      if (i === failIdx) status = 'failed'
      else if (i < failIdx) status = 'completed'
      else status = 'pending'
    } else if (i < effectiveIndex) {
      status = 'completed'
    } else if (i === effectiveIndex && !allCompleted) {
      status = 'running'
    } else {
      status = 'pending'
    }

    out.push(status)
  }

  return out
}

export const PIPELINE_SLIM_LABELS = [
  '준비',
  '수집',
  '가공',
  '흐름',
  '경쟁',
  '통찰',
  '전략',
  '액션',
  '검증',
] as const

/** Highlight the step that is running or streaming; otherwise last completed phase while loading. */
export function inferActivePipelineIndex(ctx: PipelineSlimStatusContext): number {
  const trTask = ctx.analysisTasks?.find((t) => t.step_name === 'trend_analysis')
  const coTask = ctx.analysisTasks?.find((t) => t.step_name === 'competition_analysis')
  if (trTask?.status === 'running' || coTask?.status === 'running') {
    if (coTask?.status === 'running' && trTask?.status === 'completed') return 4
    return 3
  }
  const running = ctx.analysisTasks?.find((t) => t.status === 'running')
  if (running) {
    const idx = streamTaskToStageIndex(running.step_name)
    if (idx !== null) return Math.min(8, Math.max(0, idx))
  }
  if (ctx.streamingStepId && STREAM_TO_INDEX[ctx.streamingStepId] != null) {
    return Math.min(8, Math.max(0, STREAM_TO_INDEX[ctx.streamingStepId]))
  }
  if (ctx.allCompleted) return 8
  if (ctx.currentStep >= 0) return Math.min(8, Math.max(0, ctx.currentStep))
  return 0
}
