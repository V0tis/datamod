'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Check, Loader2, ChevronDown, ChevronUp, Sparkles, AlertCircle, AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useResearchStore } from '@/lib/stores/research-store'
import {
  GlobalPipelineActivityStrip,
  PipelineStepActivityLog,
  filterLogsForStage,
  plainActivityPreview,
} from '@/components/research/dashboard/PipelineStepActivityLog'
import { getPhase2CompetitionRowStatus, getPhase2TrendRowStatus } from '@/lib/analysis/phase2-row-status'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
import { getAnalysisErrorMessage } from '@/lib/analysis-error-messages'
import { getProviderDisplayName, getProviderStatusKo } from '@/lib/ai/provider-display'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AnalysisProgressMeta } from '@/lib/types/analysis-modes'

/** AI Analysis Timeline - 8 steps: 5파이프라인 + 리스크평가 + 기회점수산출 + 완료 */
const PIPELINE_STAGES = [
  { id: 'signal_layer', label: '데이터 수집', taskId: 'signal_layer' as const, sectionLabel: '수집된 시그널' },
  { id: 'trend_analysis', label: '시장 리서치', taskId: 'trend_analysis' as const, sectionLabel: '시장 개요' },
  { id: 'competition_analysis', label: '경쟁사 분석', taskId: 'competition_analysis' as const, sectionLabel: '감지된 경쟁사' },
  { id: 'insight_extraction', label: '인사이트 추출', taskId: 'insight_extraction' as const, sectionLabel: '핵심 인사이트' },
  { id: 'strategy_generation', label: '전략 추천', taskId: 'strategy_generation' as const, sectionLabel: '리스크 및 기회' },
  { id: 'execution_layer', label: 'PM 액션 플랜', taskId: 'execution_layer' as const, sectionLabel: '제안 전략' },
  { id: 'risks_opportunities', label: '리스크 및 기회 평가', taskId: 'risk_opportunity' as const, sectionLabel: '리스크 및 기회', isVirtual: true },
  { id: 'post_processing', label: '기회 점수·차트 산출', taskId: 'post_processing' as const, sectionLabel: '기회 점수·차트', isVirtual: true },
  { id: 'done', label: '분석 완료', taskId: 'done' as const, sectionLabel: '', isVirtual: true },
] as const

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

export interface PipelineStageInsight {
  /** Section header (e.g. "Signals detected", "AI Insight") */
  sectionLabel?: string
  /** Main reasoning paragraph (AI Insight, strategy summary) */
  summary?: string
  /** Bullet points (signals, competitors, risks, actions) */
  signals?: string[]
  /** 수집된 시그널: 제목 + URL (클릭 시 원문 이동) */
  signalItems?: Array<{ title: string; url?: string }>
}

export interface StrategyEnginePipelineProps {
  keyword: string
  /** Backend current step (0–6). -1 = not started. 6 = all done. */
  currentStep: number
  /** When true, all stages show as completed */
  allCompleted?: boolean
  streamingStepId?: string
  /** Current article title during article_extraction/article_summary (e.g. "기사 읽는 중: ...") */
  currentArticleTitle?: string
  /** Shown when retrying after 429 (e.g. "재시도 중...") */
  retryMessage?: string
  taskData?: Partial<Record<string, unknown>>
  /** Polled task status from backend (real state) */
  analysisTasks?: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    output_data: unknown
    error_message: string | null
    provider?: string | null
    fallback_used?: boolean
    primary_provider_error?: string | null
  }> | null
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  /** 실패한 단계의 `taskId`를 넘기면 해당 단계만 재시도, 생략 시 상위에서 전체 재분석 등 처리 */
  onRetryStep?: (failedStepTaskId?: string) => void
  /** Global analysis failure - timeline stays visible, this step shows error */
  hasError?: boolean
  /** Step index (0–4) where global error occurred */
  errorStepIndex?: number
  /** Error message to show in failed step when task.error_message is empty */
  globalErrorMessage?: string
  /** Hero 내장 시 카드/박스 중첩 제거, 기회 점수 그리드와 시각적 통일 */
  embedded?: boolean
  /** 접이식 헤더와 중복되지 않게 상단 스파클 제목 행 숨김 */
  hidePipelineTitle?: boolean
  /** 에러 시 재시도 버튼·행 강조(접이식에서 자동 펼침과 함께 사용) */
  prominentFailedRetry?: boolean
  /** AI 우선 모델 (run/setting) - task.provider 없을 때 fallback. priority: step > run > setting */
  aiPrimaryModel?: 'gemini' | 'groq'
  /** reportId - 변경 시 타임라인 상태 초기화 (stale error 방지) */
  resultId?: string | null
  /** 스트리밍 중 진행 메타(최종 정제 문구 등) */
  streamingProgressMeta?: AnalysisProgressMeta | null
  /** 분석이 아직 끝나지 않았을 때(폴링/스트림) 큐 대기 배너 판별에 사용 */
  pipelineInFlight?: boolean
  result?: {
    marketNews?: string[]
    painPoints?: string[]
    competitorTrends?: string
    key_metrics?: {
      positive_signals?: string[]
      neutral_signals?: string[]
      negative_risks?: string[]
      summary_insights?: string
      pm_actions?: { recommended_actions?: Array<{ title?: string; reasoning?: string }> }
    }
  } | null
  className?: string
}

function getStageInsight(
  stageIndex: number,
  taskData: Partial<Record<string, unknown>>,
  analysisTask: { output_data?: unknown } | null,
  result: StrategyEnginePipelineProps['result'],
  newsList: Array<{ title?: string; url?: string; publisher?: string }>
): PipelineStageInsight | null {
  const stage = PIPELINE_STAGES[stageIndex]
  const taskId = stage?.taskId
  const td = (analysisTask?.output_data && typeof analysisTask.output_data === 'object'
    ? analysisTask.output_data
    : taskId ? taskData[taskId] : null) as Record<string, unknown> | null
  const km = result?.key_metrics ?? {}

  if (td && typeof td === 'object') {
    const obj = td as Record<string, unknown>
    const signals = Array.isArray(obj.signals)
      ? (obj.signals as string[]).filter((s) => typeof s === 'string')
      : undefined
    const news_activity = Array.isArray(obj.news_activity)
      ? (obj.news_activity as Array<{ title?: string; url?: string; publisher?: string }>)
      : []
    const trend_summary =
      typeof obj.trend_summary === 'string'
        ? obj.trend_summary
        : typeof obj.summary === 'string'
          ? obj.summary
          : undefined
    const growth_signals = Array.isArray(obj.growth_signals)
      ? (obj.growth_signals as string[]).filter((s) => typeof s === 'string')
      : Array.isArray(obj.insights)
        ? (obj.insights as string[]).filter((s) => typeof s === 'string')
        : undefined
    const competitive_landscape = Array.isArray(obj.competitive_landscape)
      ? obj.competitive_landscape
      : []
    const compSignals = competitive_landscape
      .slice(0, 8)
      .map((c) =>
        typeof c === 'object' && c && typeof (c as { name?: string }).name === 'string'
          ? (c as { name: string }).name
          : ''
      )
      .filter(Boolean)
    const opportunities = Array.isArray(obj.opportunities)
      ? (obj.opportunities as string[]).filter((s) => typeof s === 'string')
      : []
    const risks = Array.isArray(obj.risks)
      ? (obj.risks as string[]).filter((s) => typeof s === 'string')
      : []
    const strategy_summary =
      typeof obj.strategy_summary === 'string' ? obj.strategy_summary : undefined
    const product_actions = Array.isArray(obj.product_actions) ? obj.product_actions : []
    const actionSignals = product_actions
      .slice(0, 5)
      .map((a) =>
        typeof a === 'object' && a && typeof (a as { action?: string }).action === 'string'
          ? (a as { action: string }).action
          : ''
      )
      .filter(Boolean)
    const feature_ideas = Array.isArray(obj.feature_ideas)
      ? (obj.feature_ideas as string[]).filter((s) => typeof s === 'string')
      : []
    const go_to_market = Array.isArray(obj.go_to_market_steps)
      ? (obj.go_to_market_steps as string[]).filter((s) => typeof s === 'string')
      : []

    switch (stageIndex) {
      case 0: {
        // 시장 신호 수집: headlines + URL (클릭 시 원문 이동)
        const itemsWithUrl = news_activity
          .slice(0, 5)
          .map((n) => {
            const title = (n.title ?? '').trim().slice(0, 80)
            if (!title) return null
            const url = n.url ?? newsList.find((nl) => (nl.title ?? '').trim() === title)?.url
            return { title, url }
          })
          .filter((x): x is { title: string; url: string | undefined } => !!x)
        if (itemsWithUrl.length > 0) {
          return {
            sectionLabel: '수집된 시그널',
            summary: news_activity.length > 0
              ? `${news_activity.length}건 뉴스·시장 데이터 수집 완료`
              : undefined,
            signalItems: itemsWithUrl,
            signals: itemsWithUrl.map((x) => x.title),
          }
        }
        const sourceSignals = signals?.length ? signals : ['Google News', 'RSS 피드']
        return {
          sectionLabel: '수집된 시그널',
          summary: news_activity.length > 0
            ? `${news_activity.length}건 뉴스·시장 데이터 수집 완료`
            : undefined,
          signals: sourceSignals.slice(0, 5),
        }
      }
      case 1:
        return {
          sectionLabel: 'AI 인사이트',
          summary: trend_summary,
          signals: growth_signals?.slice(0, 5),
        }
      case 2:
        return {
          sectionLabel: '감지된 경쟁사',
          summary: typeof obj.market_structure === 'string' ? obj.market_structure : undefined,
          signals: compSignals.slice(0, 6),
        }
      case 3:
        return {
          sectionLabel: '리스크 신호',
          summary: strategy_summary,
          signals: [...risks.slice(0, 4), ...opportunities.slice(0, 2)].filter(Boolean).slice(0, 6),
        }
    case 4:
      const execSignals4 = [
          ...actionSignals,
          ...feature_ideas.slice(0, 3),
          ...go_to_market.slice(0, 2),
        ].filter(Boolean)
        const strategySummary = actionSignals[0]
          ? `초기 수용자 타겟: ${actionSignals[0]}`
          : feature_ideas[0]
            ? `Core value: ${feature_ideas[0]}`
            : execSignals4.length > 0
              ? `${execSignals4.length}개 전략 액션 도출`
              : undefined
        return {
          sectionLabel: '제안 전략',
          summary: strategySummary,
          signals: execSignals4.slice(0, 5),
        }
    case 5:
      // 리스크 및 기회 평가 - from strategy_generation
      return {
        sectionLabel: '리스크 및 기회',
        summary: strategy_summary,
        signals: [...risks.slice(0, 3), ...opportunities.slice(0, 3)].filter(Boolean).slice(0, 6),
      }
    case 6:
      // 기회 점수·차트 산출 (post_processing) - 별도 task 데이터 없음
      return null
    case 7:
      return null
    }
  }

  // Fallback from result (history load)
  switch (stageIndex) {
    case 0:
      if (newsList.length > 0) {
        const signalItems = newsList
          .slice(0, 5)
          .map((n) => {
            const title = (n.title ?? '').trim().slice(0, 80)
            if (!title) return null
            return { title, url: n.url }
          })
          .filter((x): x is { title: string; url: string | undefined } => !!x)
        if (signalItems.length > 0) {
          return {
            sectionLabel: '수집된 시그널',
            summary: `${newsList.length}건 시장 데이터 수집`,
            signalItems,
            signals: signalItems.map((x) => x.title),
          }
        }
        const publishers = [...new Set(newsList.map((n) => n.publisher).filter(Boolean))].slice(0, 5) as string[]
        return {
          sectionLabel: '수집된 시그널',
          summary: `${newsList.length}건 시장 데이터 수집`,
          signals: publishers.length ? publishers : ['Google News', 'RSS 피드'],
        }
      }
      return null
    case 1:
      return {
        sectionLabel: 'AI 인사이트',
        summary: km.summary_insights ?? result?.marketNews?.[0],
        signals: (km.positive_signals ?? result?.marketNews ?? []).slice(0, 4),
      }
    case 2:
      return {
        sectionLabel: '감지된 경쟁사',
        summary: result?.competitorTrends,
        signals: (km.neutral_signals ?? []).slice(0, 4),
      }
    case 3:
      const pos = km.positive_signals ?? []
      const neg = km.negative_risks ?? result?.painPoints ?? []
      return {
        sectionLabel: '리스크 신호',
        summary: pos.length || neg.length ? `${pos.length}개 기회, ${neg.length}개 리스크` : undefined,
        signals: [...neg.slice(0, 4), ...pos.slice(0, 2)].filter(Boolean),
      }
    case 4:
      const actions = km.pm_actions?.recommended_actions ?? []
      return {
        sectionLabel: '제안 전략',
        summary: actions.length ? `${actions.length}개 전략 액션 도출` : undefined,
        signals: actions.slice(0, 4).map((a) => a?.title ?? '').filter(Boolean),
      }
    case 5:
      const pos5 = km.positive_signals ?? []
      const neg5 = km.negative_risks ?? result?.painPoints ?? []
      return {
        sectionLabel: '리스크 및 기회',
        summary: pos5.length || neg5.length ? `${pos5.length}개 기회, ${neg5.length}개 리스크` : undefined,
        signals: [...neg5.slice(0, 3), ...pos5.slice(0, 3)].filter(Boolean),
      }
    case 6:
    case 7:
      return null
  }

  return null
}

export function StrategyEnginePipeline({
  keyword,
  currentStep,
  allCompleted = false,
  streamingStepId,
  currentArticleTitle,
  retryMessage,
  taskData = {},
  analysisTasks = null,
  newsList = [],
  onRetryStep,
  hasError = false,
  errorStepIndex = 0,
  globalErrorMessage,
  result,
  embedded = false,
  hidePipelineTitle = false,
  prominentFailedRetry = false,
  aiPrimaryModel = 'gemini',
  resultId,
  streamingProgressMeta = null,
  pipelineInFlight = false,
  className,
}: StrategyEnginePipelineProps) {
  /** 단계별 '분석 결과' 카드 펼침 — 분석 완료 후 사용자가 연 경우에만 true */
  const [insightOpen, setInsightOpen] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setInsightOpen({})
  }, [resultId])

  const globalStripRef = useRef<HTMLDivElement>(null)

  type TaskItem = NonNullable<typeof analysisTasks> extends (infer U)[] ? U : never
  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => { acc[t.step_name] = t; return acc },
    {} as Record<string, TaskItem>
  )

  const effectiveIndex = allCompleted
    ? 7
    : streamingStepId === 'competition_analysis' && taskMap['trend_analysis']?.status !== 'completed'
      ? 1
      : streamingStepId && STREAM_TO_INDEX[streamingStepId] != null
        ? STREAM_TO_INDEX[streamingStepId]
        : currentStep >= 0
          ? currentStep
          : 0

  const [stepStartTime, setStepStartTime] = useState(0)
  const [tickTime, setTickTime] = useState(0)
  useEffect(() => {
    setStepStartTime(Date.now())
  }, [effectiveIndex])
  useEffect(() => {
    const id = setInterval(() => setTickTime(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const stepElapsedMs = tickTime - stepStartTime

  type StageStatus = 'pending' | 'running' | 'completed' | 'failed'
  function getStatus(i: number): StageStatus {
    const stage = PIPELINE_STAGES[i]
    const taskId = stage?.taskId
    const task = taskId && taskId !== 'done' ? taskMap[taskId] : null
    const failIdx = hasError ? Math.min(errorStepIndex, 7) : -1
    // Global error: failed step always shows failed (do not render error+running)
    if (hasError && failIdx >= 0 && i === failIdx) return 'failed'
    if (i === 1) return getPhase2TrendRowStatus(taskMap['trend_analysis'])
    if (i === 2) return getPhase2CompetitionRowStatus(taskMap['trend_analysis'], taskMap['competition_analysis'])
    // Stage 0: 신호 수집 완료 후에도 기사 추출·요약이 돌면 같은 단계를 running으로 유지 (완료처럼 멈춘 것처럼 보이는 버그 방지)
    if (i === 0) {
      if (
        streamingStepId === 'article_extraction' ||
        streamingStepId === 'article_summary' ||
        taskMap['article_extraction']?.status === 'running' ||
        taskMap['article_summary']?.status === 'running'
      ) {
        return 'running'
      }
    }
    // Real task status - do not infer when we have it
    if (task && task.status) {
      if (task.status === 'failed') return 'failed'
      if (task.status === 'completed') return 'completed'
      if (task.status === 'running') return 'running'
      return 'pending'
    }
    if (i === 6) {
      const riskTask = taskMap['risk_opportunity']
      if (riskTask) return riskTask.status
      /** task 행이 아직 없어도 key_metrics가 오면 리스크/기회 단계는 완료로 */
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
    if (i === 7) {
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
    if (i === 8) return allCompleted ? 'completed' : 'pending'
    // Global error when no task: failed step + completed before + pending after
    if (hasError && failIdx >= 0) {
      if (i === failIdx) return 'failed'
      if (i < failIdx) return 'completed'
      return 'pending'
    }
    if (i < effectiveIndex) return 'completed'
    if (i === effectiveIndex && !allCompleted) return 'running'
    return 'pending'
  }

  const failIdx = hasError ? Math.min(errorStepIndex, 7) : -1

  const queueWaitingBanner = (() => {
    if (!pipelineInFlight || allCompleted) return false
    const statuses = PIPELINE_STAGES.map((_, i) => getStatus(i))
    if (statuses.some((s) => s === 'running')) return false
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i - 1] === 'completed' && statuses[i] === 'pending') return true
    }
    return false
  })()

  const streamingActivityLog = useResearchStore((s) => s.streamingActivityLog)
  const activityRows = useMemo(
    () =>
      streamingActivityLog.map((r) => ({
        ts: r.ts,
        message: r.message,
        kind: r.kind,
        type: r.type,
        stepId: r.stepId,
      })),
    [streamingActivityLog]
  )

  return (
    <div
      className={cn(
        !embedded &&
          'rounded-lg border border-slate-200/90 bg-slate-50/40 shadow-sm overflow-hidden dark:border-zinc-800 dark:bg-zinc-950/30',
        className
      )}
    >
      <div className={cn('flex flex-col gap-4', embedded ? 'py-2' : 'p-5 sm:p-6')}>
        {!hidePipelineTitle ? (
          <div className={cn('flex items-center gap-2 min-w-0', embedded ? '' : 'pb-0.5 border-b border-slate-200/70 dark:border-zinc-800')}>
            <Sparkles className="h-4 w-4 text-slate-600 dark:text-zinc-400 shrink-0" />
            <div className="min-w-0">
              <span className={cn(embedded ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-semibold tracking-tight text-slate-800 dark:text-zinc-100')}>
                {allCompleted ? `분석 완료 · "${keyword}"` : `분석 파이프라인 · "${keyword}"`}
              </span>
            </div>
          </div>
        ) : null}

        <div className="relative">
          <GlobalPipelineActivityStrip logs={activityRows} stripRef={globalStripRef} />
          {queueWaitingBanner ? (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/95 px-3 py-2.5 text-xs leading-snug text-sky-950 dark:border-sky-900/80 dark:bg-sky-950/50 dark:text-sky-100"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-400" aria-hidden />
              <div>
                <p className="font-semibold text-sky-950 dark:text-sky-50">다음 분석 준비 중…</p>
                <p className="mt-0.5 text-[11px] text-sky-900/90 dark:text-sky-200/95">
                  큐 대기 중이거나 서버가 다음 단계를 배정하는 중입니다. 실시간 상태와 함께 곧 이어집니다.
                </p>
              </div>
            </div>
          ) : null}
          {PIPELINE_STAGES.map((stage, i) => {
            const status = getStatus(i)
            const taskKey = stage.taskId && stage.taskId !== 'done' ? stage.taskId : stage.id
            const analysisTask = taskMap[taskKey] ?? null
            const insight =
              status === 'completed'
                ? getStageInsight(i, taskData, analysisTask, result, newsList)
                : null
            const hasInsight = insight && (insight.summary || (insight.signals?.length ?? 0) > 0)
            const showInsightPanel = Boolean(hasInsight && status === 'completed')
            const task = taskMap[taskKey] ?? null

            const isError = status === 'failed'
            const stageLogs = filterLogsForStage(activityRows, i)

            return (
              <div
                key={stage.id}
                className={cn(
                  'relative border-l-2 pl-5 pb-8 last:pb-2',
                  !isError && 'border-slate-200 dark:border-zinc-700',
                  isError &&
                    'rounded-r-lg border-red-300/90 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30',
                  isError && prominentFailedRetry && 'ring-2 ring-red-500/45 shadow-md dark:ring-red-500/35',
                )}
              >
                <div className="absolute -left-[9px] top-1.5 z-[1]" aria-hidden>
                  {status === 'completed' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-background ring-4 ring-background dark:border-zinc-600 dark:bg-zinc-950 dark:ring-zinc-950">
                      <Check className="h-2.5 w-2.5 text-slate-500" strokeWidth={3} />
                    </span>
                  )}
                  {status === 'running' && (
                    <span className="flex h-3 w-3 items-center justify-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_0_6px_rgba(59,130,246,0.2)] animate-pulse" />
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className="block h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-background dark:bg-zinc-600 dark:ring-zinc-950" />
                  )}
                  {status === 'failed' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-red-200 bg-red-50 ring-4 ring-background dark:border-red-800 dark:bg-red-950/80 dark:ring-zinc-950">
                      <AlertCircle className="h-2.5 w-2.5 text-red-600 dark:text-red-400" strokeWidth={2.5} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 pt-0.5">
                  <div
                    className={cn(
                      'text-sm font-semibold leading-snug',
                      status === 'completed' && 'text-slate-500 dark:text-slate-400',
                      status === 'running' && 'text-foreground',
                      status === 'pending' && 'text-muted-foreground',
                      status === 'failed' && 'text-red-800 dark:text-red-200',
                    )}
                  >
                    <span>{stage.label}</span>
                    <span className="ml-2 text-xs font-normal text-slate-500 dark:text-zinc-500">
                      {status === 'completed' && '완료'}
                      {status === 'running' && '진행 중'}
                      {status === 'pending' && '대기'}
                      {status === 'failed' && '실패'}
                    </span>
                  </div>

                  {status !== 'pending' && (
                    <div className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider whitespace-pre-line">
                      모델 상태:{' '}
                      {(() => {
                        const t = task as { provider?: string | null; fallback_used?: boolean; primary_provider_error?: string | null } | null
                        const provider = t?.provider ?? aiPrimaryModel
                        if (t?.fallback_used && t?.primary_provider_error) {
                          const primary = provider === 'groq' ? 'Gemini' : 'Groq'
                          const fallback = provider === 'groq' ? 'Groq' : 'Gemini'
                          return getProviderStatusKo(primary, fallback, true, t.primary_provider_error, status === 'completed' ? 'completed' : 'running')
                        }
                        return getProviderDisplayName(provider, t?.fallback_used, t?.primary_provider_error) || (provider ? (provider === 'groq' ? 'Groq' : 'Gemini') : '—')
                      })()}
                      {' · '}
                      분석 상태: {status === 'completed' ? '완료' : status === 'running' ? '실행 중' : status === 'failed' ? '실패' : '대기'}
                    </div>
                  )}

                  {status === 'running' && (
                    <div className="mt-1.5 space-y-1.5">
                      {(task as { fallback_used?: boolean; primary_provider_error?: string | null } | null)?.fallback_used &&
                      (task as { primary_provider_error?: string | null })?.primary_provider_error ? (
                        <>
                          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-500">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs font-medium">
                              {((task as { provider?: string }).provider ?? aiPrimaryModel) === 'groq' ? 'Gemini' : 'Groq'}{' '}
                              {(() => {
                                const err = (task as { primary_provider_error?: string }).primary_provider_error
                                return err === 'quota exceeded'
                                  ? '쿼터 초과'
                                  : err === 'timeout'
                                    ? '타임아웃'
                                    : err === 'network error'
                                      ? '네트워크 오류'
                                      : err?.replace(/_/g, ' ') ?? ''
                              })()}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-zinc-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" aria-hidden />
                            <span>
                              {((task as { provider?: string }).provider ?? aiPrimaryModel) === 'groq' ? 'Groq' : 'Gemini'}로 재시도 중...
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start gap-2 min-w-0">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 shrink-0 mt-0.5" aria-hidden />
                          <span className="text-[11px] leading-snug text-slate-600 dark:text-zinc-400 line-clamp-2 min-w-0">
                            {(() => {
                              const lastEntry = stageLogs[stageLogs.length - 1]
                              if (lastEntry?.message) return plainActivityPreview(lastEntry.message, 180)
                              if (retryMessage && i === effectiveIndex) return retryMessage
                              return getAnalysisActivityMessage(i === effectiveIndex ? (streamingStepId ?? stage.id) : stage.id, i, {
                                short: true,
                                elapsedMs: i === effectiveIndex ? stepElapsedMs : undefined,
                                currentArticleTitle: i === effectiveIndex ? currentArticleTitle : undefined,
                                progressMeta: i === effectiveIndex ? streamingProgressMeta ?? undefined : undefined,
                              })
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {status === 'failed' && (() => {
                    const rawError =
                      (task as { error_message?: string } | null)?.error_message?.trim() ||
                      globalErrorMessage?.trim() ||
                      ''
                    const fallbackCopy = '데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    const rawForParse = rawError || fallbackCopy
                    const { description, recoveryHint, possibleCauses, variant: errVariant } = getAnalysisErrorMessage(rawForParse)
                    const isQuota = errVariant === 'quota'
                    return (
                      <div className="mt-2 space-y-2" role="alert">
                        <div className="text-sm font-medium text-foreground">
                          {rawError ? '분석 단계에서 오류가 발생했습니다' : '데이터를 불러오지 못했습니다'}
                        </div>
                        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
                        {recoveryHint ? <div className="text-xs text-muted-foreground">{recoveryHint}</div> : null}
                        {possibleCauses && possibleCauses.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">가능한 원인</div>
                            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                              {possibleCauses.map((cause, j) => (
                                <li key={j}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {onRetryStep && (
                            <Button
                              variant={prominentFailedRetry ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => onRetryStep(taskKey || undefined)}
                              className={cn(
                                'gap-1.5 h-9 text-xs font-medium',
                                prominentFailedRetry
                                  ? 'shadow-sm'
                                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
                              )}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {prominentFailedRetry ? '재시도' : '이 단계만 재시도'}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-xs">
                            <Link href="/">
                              <Home className="h-3.5 w-3.5" />
                              대시보드로
                            </Link>
                          </Button>
                          {isQuota && (
                            <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-xs">
                              <Link href="/settings">설정으로 이동</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  <PipelineStepActivityLog logs={stageLogs} status={status} previewCount={3} compact />

                  {showInsightPanel && insight && (
                    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800/90">
                      <button
                        type="button"
                        onClick={() => setInsightOpen((o) => ({ ...o, [i]: !o[i] }))}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200/90 bg-white/70 px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50/90 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-200 dark:hover:bg-zinc-900/80"
                      >
                        <span>분석 결과</span>
                        {insightOpen[i] ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        )}
                      </button>
                      {insightOpen[i] ? (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-3 space-y-2.5 dark:border-zinc-800 dark:bg-zinc-900/40">
                            {insight.sectionLabel ? (
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                {insight.sectionLabel}
                              </div>
                            ) : null}
                            {insight.summary ? (
                              <div className="text-sm text-foreground leading-relaxed">{insight.summary}</div>
                            ) : null}
                            {(insight.signalItems?.length ?? 0) > 0 ? (
                              <ul className="space-y-1">
                                {insight.signalItems!.map((item, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                                    <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                    {item.url ? (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-slate-700 underline-offset-2 hover:underline truncate max-w-full dark:text-zinc-200"
                                      >
                                        {item.title}
                                      </a>
                                    ) : (
                                      <span>{item.title}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : insight.signals && insight.signals.length > 0 ? (
                              <ul className="space-y-1">
                                {insight.signals.map((s, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                                    <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
