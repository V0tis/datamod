/**
 * Shared pipeline stage status for slim stepper (keeps parity with StrategyEnginePipeline).
 */

import { streamTaskToStageIndex } from '@/lib/analysis/pipeline-activity-step'
import type { ResearchResponse } from '@/lib/stores/research-store'

const STREAM_TO_INDEX: Record<string, number> = {
  signal_layer: 0,
  news: 0,
  article_extraction: 0,
  article_summary: 0,
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
  post_processing: 7,
  post_processing_key_metrics: 7,
  post_processing_creative: 7,
  post_processing_saving: 7,
  final_refining: 7,
  done: 8,
}

const PIPELINE_STAGE_META = [
  { taskId: 'signal_layer' as const },
  { taskId: 'trend_analysis' as const },
  { taskId: 'competition_analysis' as const },
  { taskId: 'insight_extraction' as const },
  { taskId: 'strategy_generation' as const },
  { taskId: 'execution_layer' as const },
  { taskId: 'risk_opportunity' as const },
  { taskId: 'post_processing' as const },
  { taskId: 'done' as const },
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
  currentStep: number
): number {
  if (allCompleted) return 7
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

  const effectiveIndex = computeEffectivePipelineIndex(allCompleted, streamingStepId, currentStep)
  const failIdx = hasError ? Math.min(errorStepIndex, 7) : -1

  const out: PipelineStageStatus[] = []

  for (let i = 0; i < PIPELINE_STAGE_META.length; i++) {
    const stage = PIPELINE_STAGE_META[i]
    const taskId = stage.taskId
    const task = taskId !== 'done' ? taskMap[taskId] : null

    let status: PipelineStageStatus

    if (hasError && failIdx >= 0 && i === failIdx) {
      status = 'failed'
    } else if (task && task.status) {
      if (task.status === 'failed') status = 'failed'
      else if (task.status === 'completed') status = 'completed'
      else if (task.status === 'running') status = 'running'
      else status = 'pending'
    } else if (i === 0 && (streamingStepId === 'article_extraction' || streamingStepId === 'article_summary')) {
      status = 'running'
    } else if (i === 6) {
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
    } else if (i === 7) {
      if (
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
    } else if (i === 8) {
      status = allCompleted ? 'completed' : 'pending'
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
  '수집',
  '시장',
  '경쟁',
  '인사이트',
  '전략',
  '실행',
  '리스크',
  '점수',
  '완료',
] as const

/** Highlight the step that is running or streaming; otherwise last completed phase while loading. */
export function inferActivePipelineIndex(ctx: PipelineSlimStatusContext): number {
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
