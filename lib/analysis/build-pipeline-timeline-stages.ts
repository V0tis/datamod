import { STREAM_TO_NINE_INDEX } from '@/lib/analysis/pipeline-nine-stage'
import { getPhase2CompetitionRowStatus, getPhase2TrendRowStatus } from '@/lib/analysis/phase2-row-status'
import type { ResearchResponse } from '@/lib/stores/research-store'

export const PIPELINE_TIMELINE_UI_STAGES = [
  { id: 'cache', label: '캐시 조회', eta: '<1초' },
  { id: 'collect', label: '시장 데이터 수집', eta: '~10초' },
  { id: 'issues', label: '핵심 이슈 정리', eta: '~8초' },
  { id: 'trend', label: '시장 흐름 분석', eta: '~12초' },
  { id: 'competitor', label: '경쟁사 분석', eta: '~12초' },
  { id: 'insight', label: '인사이트 제안', eta: '~10초' },
  { id: 'strategy', label: '전략 추천', eta: '~10초' },
  { id: 'action', label: 'PM 액션 플랜', eta: '~8초' },
  { id: 'risk', label: '리스크·기회 평가', eta: '~8초' },
] as const

export type PipelineTimelineUiStageId = (typeof PIPELINE_TIMELINE_UI_STAGES)[number]['id']

export type PipelineTimelineBuiltStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

export type PipelineTimelineBuiltStage = {
  id: string
  status: PipelineTimelineBuiltStatus
  startedAt?: number
  completedAt?: number
  errorMessage?: string
  rawOutput?: unknown
}

type TaskLike = {
  step_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  output_data?: unknown
  error_message?: string | null
  started_at?: string | null
  completed_at?: string | null
}

const STREAM_TO_INDEX = STREAM_TO_NINE_INDEX

function isoToMs(iso: string | null | undefined): number | undefined {
  if (!iso) return undefined
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : undefined
}

function mergeOutput(
  taskMap: Record<string, TaskLike | undefined>,
  taskData: Partial<Record<string, unknown>>,
  key: string
): unknown {
  const row = taskMap[key]
  const fromRow = row?.output_data
  const raw = fromRow && typeof fromRow === 'object' ? fromRow : taskData[key as keyof typeof taskData]
  return raw ?? null
}

/** UI 인덱스 0–8 ↔ 백엔드 실패/재시도용 step_name (캐시 단계는 analysis_prep) */
export function pipelineTimelineUiIndexToTaskId(index: number): string | undefined {
  const map = [
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
  if (index < 0 || index >= map.length) return undefined
  return map[index]
}

export function uiStageIdToRetryTaskId(stageId: string): string | undefined {
  const i = PIPELINE_TIMELINE_UI_STAGES.findIndex((s) => s.id === stageId)
  if (i < 0) return undefined
  return pipelineTimelineUiIndexToTaskId(i)
}

export function buildPipelineTimelineStages(input: {
  analysisTasks: TaskLike[] | null | undefined
  taskData?: Partial<Record<string, unknown>>
  streamingStepId?: string | undefined
  currentStep: number
  allCompleted: boolean
  pipelineInFlight: boolean
  hasError: boolean
  errorStepIndex: number
  result: ResearchResponse | null | undefined
  pipelineServedFromServerCache: boolean
  globalErrorMessage?: string | null
}): PipelineTimelineBuiltStage[] {
  const {
    analysisTasks,
    taskData = {},
    streamingStepId,
    currentStep,
    allCompleted,
    pipelineInFlight,
    hasError,
    errorStepIndex,
    result,
    pipelineServedFromServerCache,
    globalErrorMessage,
  } = input

  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => {
      acc[t.step_name] = t
      return acc
    },
    {} as Record<string, TaskLike | undefined>
  )

  const effectiveIndex = allCompleted
    ? 8
    : streamingStepId === 'competition_analysis' && taskMap['trend_analysis']?.status !== 'completed'
      ? 3
      : streamingStepId && STREAM_TO_INDEX[streamingStepId] != null
        ? STREAM_TO_INDEX[streamingStepId]!
        : currentStep >= 0
          ? currentStep
          : 0

  const failIdx = hasError ? Math.min(Math.max(errorStepIndex, 0), 8) : -1
  const sig = taskMap['signal_layer']
  const artEx = taskMap['article_extraction']
  const artSum = taskMap['article_summary']

  type BackendStatus = 'pending' | 'running' | 'completed' | 'failed'

  function backendStatusForUiIndex(i: number): BackendStatus {
    if (hasError && failIdx >= 0 && i === failIdx) return 'failed'

    if (i === 0) {
      if (pipelineServedFromServerCache && allCompleted) return 'completed'
      if (!pipelineInFlight && !sig) return 'pending'
      if (!sig) return 'running'
      if (sig.status === 'pending') return 'running'
      return 'completed'
    }

    if (i === 1) {
      const task = taskMap['signal_layer']
      if (task?.status === 'failed') return 'failed'
      if (task?.status === 'completed') return 'completed'
      if (task?.status === 'running') return 'running'
      if (hasError && failIdx >= 0) {
        if (i === failIdx) return 'failed'
        if (i < failIdx) return 'completed'
        return 'pending'
      }
      if (i < effectiveIndex) return 'completed'
      if (i === effectiveIndex && !allCompleted) return 'running'
      return 'pending'
    }

    if (i === 2) {
      if (sig?.status !== 'completed' && sig?.status !== 'failed') return 'pending'
      const articleRunning =
        streamingStepId === 'article_extraction' ||
        streamingStepId === 'article_summary' ||
        artEx?.status === 'running' ||
        artSum?.status === 'running'
      if (articleRunning) return 'running'
      if (!artEx && !artSum) return 'completed'
      const exDone = !artEx || artEx.status === 'completed' || artEx.status === 'failed'
      const smDone = !artSum || artSum.status === 'completed' || artSum.status === 'failed'
      if (artEx?.status === 'failed' || artSum?.status === 'failed') return 'failed'
      if (exDone && smDone && (artEx?.status === 'completed' || artSum?.status === 'completed' || (!artEx && !artSum)))
        return 'completed'
      if (exDone && smDone) return 'completed'
      return 'pending'
    }

    if (i === 3) return getPhase2TrendRowStatus(taskMap['trend_analysis'])
    if (i === 4) return getPhase2CompetitionRowStatus(taskMap['trend_analysis'], taskMap['competition_analysis'])

    if (i >= 5 && i <= 7) {
      const keys = ['insight_extraction', 'strategy_generation', 'execution_layer'] as const
      const task = taskMap[keys[i - 5]]
      if (task?.status === 'failed') return 'failed'
      if (task?.status === 'completed') return 'completed'
      if (task?.status === 'running') return 'running'
      if (task?.status === 'pending') return 'pending'
      if (hasError && failIdx >= 0) {
        if (i === failIdx) return 'failed'
        if (i < failIdx) return 'completed'
        return 'pending'
      }
      if (i < effectiveIndex) return 'completed'
      if (i === effectiveIndex && !allCompleted) return 'running'
      return 'pending'
    }

    if (i === 8) {
      const riskTask = taskMap['risk_opportunity']
      if (riskTask?.status === 'failed') return 'failed'
      if (riskTask?.status === 'completed') return 'completed'
      if (riskTask?.status === 'running') return 'running'
      if (riskTask?.status === 'pending') return 'pending'
      if (
        result?.key_metrics != null &&
        typeof (result.key_metrics as { opportunity_score?: unknown }).opportunity_score === 'number'
      )
        return 'completed'
      const isPostProcessing =
        streamingStepId &&
        (streamingStepId.startsWith('post_processing_') ||
          streamingStepId === 'post_processing' ||
          streamingStepId === 'final_refining')
      return allCompleted ? 'completed' : isPostProcessing ? 'running' : 'pending'
    }

    return 'pending'
  }

  function toUiStatus(i: number, backend: BackendStatus): PipelineTimelineBuiltStatus {
    if (i === 0 && pipelineServedFromServerCache && allCompleted) return 'skipped'
    if (backend === 'completed') return 'done'
    if (backend === 'failed') return 'error'
    if (backend === 'running') return 'running'
    return 'pending'
  }

  function rawForIndex(i: number): unknown {
    switch (i) {
      case 0:
        return (
          mergeOutput(taskMap, taskData, 'analysis_prep') ??
          ({ stage: 'cache', note: '캐시·준비 단계 — 상세는 수집 단계 이후 출력에서 확인할 수 있습니다.' } as const)
        )
      case 1:
        return mergeOutput(taskMap, taskData, 'signal_layer')
      case 2:
        return mergeOutput(taskMap, taskData, 'article_extraction') ?? mergeOutput(taskMap, taskData, 'article_summary')
      case 3:
        return mergeOutput(taskMap, taskData, 'trend_analysis')
      case 4:
        return mergeOutput(taskMap, taskData, 'competition_analysis')
      case 5:
        return mergeOutput(taskMap, taskData, 'insight_extraction')
      case 6:
        return mergeOutput(taskMap, taskData, 'strategy_generation')
      case 7:
        return mergeOutput(taskMap, taskData, 'execution_layer')
      case 8:
        return mergeOutput(taskMap, taskData, 'risk_opportunity')
      default:
        return null
    }
  }

  function taskRowsForIndex(i: number): TaskLike[] {
    switch (i) {
      case 0:
        return [sig].filter(Boolean) as TaskLike[]
      case 1:
        return sig ? [sig] : []
      case 2:
        return [artEx, artSum].filter(Boolean) as TaskLike[]
      case 3:
        return taskMap['trend_analysis'] ? [taskMap['trend_analysis']!] : []
      case 4:
        return taskMap['competition_analysis'] ? [taskMap['competition_analysis']!] : []
      case 5:
        return taskMap['insight_extraction'] ? [taskMap['insight_extraction']!] : []
      case 6:
        return taskMap['strategy_generation'] ? [taskMap['strategy_generation']!] : []
      case 7:
        return taskMap['execution_layer'] ? [taskMap['execution_layer']!] : []
      case 8:
        return taskMap['risk_opportunity'] ? [taskMap['risk_opportunity']!] : []
      default:
        return []
    }
  }

  const out: PipelineTimelineBuiltStage[] = []
  for (let i = 0; i < PIPELINE_TIMELINE_UI_STAGES.length; i++) {
    const backend = backendStatusForUiIndex(i)
    const status = toUiStatus(i, backend)
    const rows = taskRowsForIndex(i)
    const startedAt = rows.map((r) => isoToMs(r.started_at)).find((n) => n != null)
    const completedAt = rows.map((r) => isoToMs(r.completed_at)).find((n) => n != null)

    let errorMessage: string | undefined
    if (status === 'error') {
      const g = globalErrorMessage?.trim()
      errorMessage =
        rows.map((r) => r.error_message?.trim()).find(Boolean) ||
        (hasError && failIdx === i ? g || '분석 단계에서 오류가 발생했습니다.' : undefined)
    }

    out.push({
      id: PIPELINE_TIMELINE_UI_STAGES[i].id,
      status,
      ...(startedAt != null ? { startedAt } : {}),
      ...(completedAt != null ? { completedAt } : {}),
      ...(errorMessage ? { errorMessage } : {}),
      rawOutput: rawForIndex(i),
    })
  }

  return out
}
