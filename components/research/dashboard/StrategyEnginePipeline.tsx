'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Check, Loader2, Circle, ChevronDown, ChevronUp, Sparkles, AlertCircle, AlertTriangle, RefreshCw, Home } from 'lucide-react'
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
  onRetryStep?: () => void
  /** Global analysis failure - timeline stays visible, this step shows error */
  hasError?: boolean
  /** Step index (0–4) where global error occurred */
  errorStepIndex?: number
  /** Error message to show in failed step when task.error_message is empty */
  globalErrorMessage?: string
  /** Hero 내장 시 카드/박스 중첩 제거, 기회 점수 그리드와 시각적 통일 */
  embedded?: boolean
  /** AI 우선 모델 (run/setting) - task.provider 없을 때 fallback. priority: step > run > setting */
  aiPrimaryModel?: 'gemini' | 'groq'
  /** reportId - 변경 시 타임라인 상태 초기화 (stale error 방지) */
  resultId?: string | null
  /** 스트리밍 중 진행 메타(최종 정제 문구 등) */
  streamingProgressMeta?: AnalysisProgressMeta | null
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
  aiPrimaryModel = 'gemini',
  resultId,
  streamingProgressMeta = null,
  className,
}: StrategyEnginePipelineProps) {
  const [expanded, setExpanded] = useState(!allCompleted)
  useEffect(() => {
    if (allCompleted) setExpanded(false)
  }, [allCompleted])
  useEffect(() => {
    if (resultId != null) setExpanded(!allCompleted)
  }, [resultId])
  type TaskItem = NonNullable<typeof analysisTasks> extends (infer U)[] ? U : never
  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => { acc[t.step_name] = t; return acc },
    {} as Record<string, TaskItem>
  )

  const effectiveIndex = allCompleted
    ? 7
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
    // Real task status - do not infer when we have it
    if (task && task.status) {
      if (task.status === 'failed') return 'failed'
      if (task.status === 'completed') return 'completed'
      if (task.status === 'running') return 'running'
      return 'pending'
    }
    // Stage 0: article_extraction/article_summary 진행 중
    if (i === 0 && (streamingStepId === 'article_extraction' || streamingStepId === 'article_summary')) {
      return 'running'
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
  const currentIdx = hasError && failIdx >= 0
    ? failIdx
    : allCompleted ? 8 : Math.min(effectiveIndex, 7)
  const currentStage = PIPELINE_STAGES[currentIdx] ?? PIPELINE_STAGES[6]

  return (
    <div
      className={cn(
        !embedded && 'rounded-lg border border-border bg-card shadow-sm overflow-hidden bg-gradient-to-b from-primary/5 to-transparent',
        className
      )}
    >
      <div className={embedded ? 'py-2' : 'p-5 sm:p-6'}>
        <div className={cn('flex items-center justify-between gap-2', embedded ? 'mb-2' : 'mb-3')}>
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <span className={cn(embedded ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-semibold text-foreground uppercase tracking-wider')}>
                {allCompleted ? `분석 완료 · "${keyword}"` : `AI가 단계별로 분석 중 · "${keyword}"`}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                타임라인 접기
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                전체 타임라인 보기
              </>
            )}
          </button>
        </div>

        {/* Collapsed: compact step list + current step detail */}
        {!expanded && (
          <div className={cn('space-y-4', embedded ? 'mb-0' : 'mb-3')}>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {PIPELINE_STAGES.slice(0, 7).map((s, i) => {
                const st = getStatus(i)
                return (
                  <span
                    key={s.id}
                    className={cn(
                      st === 'completed' && 'text-primary font-medium',
                      st === 'running' && 'text-primary font-semibold',
                      st === 'pending' && 'text-muted-foreground',
                      st === 'failed' && 'text-destructive',
                    )}
                  >
                    {st === 'completed' && '✔ '}
                    {st === 'running' && '▶ '}
                    {st === 'pending' && '○ '}
                    {st === 'failed' && '✕ '}
                    {s.label}
                  </span>
                )
              })}
            </div>
            <div
              className={cn(
                embedded ? 'rounded-md px-3 py-2 bg-muted/30' : 'rounded-xl border-2 px-5 py-4 min-h-[92px]',
                embedded && getStatus(currentIdx) === 'failed' && 'border-destructive/40 bg-destructive/10',
                !embedded && getStatus(currentIdx) === 'completed' && allCompleted && 'px-6 py-5 min-h-[100px] border-primary/50 bg-primary/5',
                !embedded && getStatus(currentIdx) === 'completed' && !allCompleted && 'border-primary/50 bg-primary/5',
                !embedded && getStatus(currentIdx) === 'running' && 'border-primary bg-primary/10 ring-2 ring-primary/20',
                !embedded && getStatus(currentIdx) === 'pending' && 'border-border/60 bg-muted/20',
                !embedded && getStatus(currentIdx) === 'failed' && 'border-destructive ring-2 ring-destructive/20 bg-destructive/10',
              )}
            >
              <div className={cn('flex items-center gap-4', getStatus(currentIdx) === 'completed' && allCompleted && !embedded && 'gap-5')}>
                <div
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full',
                    embedded ? 'h-8 w-8' : (getStatus(currentIdx) === 'running' || getStatus(currentIdx) === 'failed' ? 'h-12 w-12' : getStatus(currentIdx) === 'completed' && allCompleted ? 'h-14 w-14' : 'h-8 w-8'),
                    getStatus(currentIdx) === 'completed' && 'bg-primary text-primary-foreground',
                    getStatus(currentIdx) === 'running' && 'bg-primary/20 text-primary',
                    getStatus(currentIdx) === 'pending' && 'bg-muted text-muted-foreground',
                    getStatus(currentIdx) === 'failed' && 'bg-destructive/20 text-destructive',
                  )}
                >
                  {getStatus(currentIdx) === 'completed' && <Check className={getStatus(currentIdx) === 'completed' && allCompleted && !embedded ? 'h-7 w-7' : 'h-4 w-4'} strokeWidth={2.5} />}
                  {getStatus(currentIdx) === 'running' && <Loader2 className={embedded ? 'h-4 w-4' : 'h-6 w-6'} strokeWidth={2} />}
                  {getStatus(currentIdx) === 'pending' && <Circle className="h-3.5 w-3.5" strokeWidth={2} />}
                  {getStatus(currentIdx) === 'failed' && <AlertCircle className={embedded ? 'h-4 w-4' : 'h-6 w-6'} strokeWidth={2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    'font-semibold text-foreground',
                    embedded ? 'text-sm' : (getStatus(currentIdx) === 'completed' && allCompleted ? 'text-xl' : (getStatus(currentIdx) === 'running' || getStatus(currentIdx) === 'failed' ? 'text-base' : 'text-sm')),
                  )}>
                    {currentStage?.label ?? '분석 완료'}
                  </p>
                  {getStatus(currentIdx) === 'running' && (
                    <p className={cn('text-muted-foreground mt-1', !embedded ? 'text-sm' : 'text-xs')}>
                      {getAnalysisActivityMessage(streamingStepId ?? currentStage?.id ?? 'done', currentIdx, {
                        short: true,
                        elapsedMs: stepElapsedMs,
                        currentArticleTitle,
                        progressMeta: streamingProgressMeta ?? undefined,
                      })}
                    </p>
                  )}
                  {getStatus(currentIdx) === 'completed' && allCompleted && (
                    <p className={cn(
                      'text-muted-foreground mt-1',
                      !embedded ? 'text-base' : 'text-xs',
                    )}>
                      모든 분석이 완료되었습니다
                    </p>
                  )}
                  {getStatus(currentIdx) === 'failed' && (() => {
                    const st = PIPELINE_STAGES[currentIdx]
                    const tk = st?.taskId && st.taskId !== 'done' ? st.taskId : st?.id ?? ''
                    const rawError = (taskMap[tk] as { error_message?: string } | null)?.error_message ?? globalErrorMessage ?? '오류 발생'
                    const { description } = getAnalysisErrorMessage(rawError)
                    return (
                      <div className="mt-1 flex items-center gap-2 flex-wrap" role="alert">
                        <span className="text-xs text-destructive truncate">{description}</span>
                        {onRetryStep && (
                          <button type="button" onClick={onRetryStep} className="text-xs text-primary hover:underline shrink-0">
                            다시 분석
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expanded: full timeline (no scroll) */}
        <div className={cn('relative', expanded ? 'block' : 'hidden')}>
          {PIPELINE_STAGES.map((stage, i) => {
            const status = getStatus(i)
            const taskKey = stage.taskId && stage.taskId !== 'done' ? stage.taskId : stage.id
            const analysisTask = taskMap[taskKey] ?? null
            const insight =
              (status === 'completed' || status === 'running')
                ? getStageInsight(i, taskData, analysisTask, result, newsList)
                : null
            const hasInsight = insight && (insight.summary || (insight.signals?.length ?? 0) > 0)
            const showInsightPanel = hasInsight && (status === 'completed' || status === 'running')
            const task = taskMap[taskKey] ?? null

            return (
              <div key={stage.id} className="relative">
                {/* Node */}
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg border-2 px-4 py-3 transition-all duration-300',
                    status === 'completed' &&
                      'border-primary/50 bg-primary/5 shadow-sm',
                    status === 'running' &&
                      'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20',
                    status === 'pending' &&
                      'border-border/60 bg-muted/20 opacity-60',
                    status === 'failed' &&
                      'border-destructive ring-2 ring-destructive/20 bg-destructive/10',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                      status === 'completed' && 'border-primary bg-primary text-primary-foreground',
                      status === 'running' &&
                        'border-primary bg-primary/20 text-primary',
                      status === 'pending' &&
                        'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
                      status === 'failed' && 'border-destructive bg-destructive/20 text-destructive',
                    )}
                  >
                    {status === 'completed' && (
                      <Check className="h-5 w-5" strokeWidth={2.5} />
                    )}
                    {status === 'running' && (
                      <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2} />
                    )}
                    {status === 'pending' && (
                      <Circle className="h-4 w-4" strokeWidth={2} />
                    )}
                    {status === 'failed' && (
                      <AlertCircle className="h-5 w-5" strokeWidth={2} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={cn(
                        'text-sm font-semibold',
                        status === 'completed' && 'text-foreground',
                        status === 'running' && 'text-foreground',
                        status === 'pending' && 'text-muted-foreground',
                        status === 'failed' && 'text-destructive',
                      )}
                    >
                      {status === 'completed' && '✔ '}
                      {status === 'running' && '▶ '}
                      {status === 'pending' && '○ '}
                      {status === 'failed' && '✕ '}
                      {stage.label}
                      <span className="ml-1.5 text-xs font-normal opacity-80">
                        {status === 'completed' && '완료'}
                        {status === 'running' && '진행중'}
                        {status === 'pending' && '대기중'}
                        {status === 'failed' && '실패'}
                      </span>
                    </h3>
                    {status !== 'pending' && (
                      <p className="text-[11px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider whitespace-pre-line">
                        모델 상태: {(() => {
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
                      </p>
                    )}
                    {status === 'running' && (
                      <div className="mt-1 space-y-1">
                        {(task as { fallback_used?: boolean; primary_provider_error?: string | null } | null)?.fallback_used &&
                        (task as { primary_provider_error?: string | null })?.primary_provider_error ? (
                          <>
                            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs font-medium">
                                {((task as { provider?: string }).provider ?? aiPrimaryModel) === 'groq' ? 'Gemini' : 'Groq'} {(() => {
                                  const err = (task as { primary_provider_error?: string }).primary_provider_error
                                  return err === 'quota exceeded' ? '쿼터 초과' : err === 'timeout' ? '타임아웃' : err === 'network error' ? '네트워크 오류' : err?.replace(/_/g, ' ') ?? ''
                                })()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              {((task as { provider?: string }).provider ?? aiPrimaryModel) === 'groq' ? 'Groq' : 'Gemini'}로 재시도 중...
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {retryMessage && i === effectiveIndex
                              ? retryMessage
                              : getAnalysisActivityMessage(i === effectiveIndex ? (streamingStepId ?? stage.id) : stage.id, i, {
                                  short: true,
                                  elapsedMs: i === effectiveIndex ? stepElapsedMs : undefined,
                                  currentArticleTitle: i === effectiveIndex ? currentArticleTitle : undefined,
                                  progressMeta: i === effectiveIndex ? streamingProgressMeta ?? undefined : undefined,
                                })}
                          </p>
                        )}
                      </div>
                    )}
                    {status === 'failed' && (() => {
                      const rawError = (task as { error_message?: string } | null)?.error_message ?? globalErrorMessage ?? '오류 발생'
                      const { description, recoveryHint, possibleCauses, variant: errVariant } = getAnalysisErrorMessage(rawError)
                      const isQuota = errVariant === 'quota'
                      return (
                        <div className="mt-2 space-y-2" role="alert">
                          <p className="text-sm text-muted-foreground">{description}</p>
                          {recoveryHint && <p className="text-xs text-muted-foreground">{recoveryHint}</p>}
                          {possibleCauses && possibleCauses.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">가능한 원인</p>
                              <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                                {possibleCauses.map((cause, j) => (
                                  <li key={j}>{cause}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {onRetryStep && (
                              <Button variant="outline" size="sm" onClick={onRetryStep} className="gap-1.5 h-8 text-xs">
                                <RefreshCw className="h-3.5 w-3.5" />
                                다시 분석
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
                    {status !== 'failed' && hasInsight && (status === 'completed' || status === 'running') && insight?.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {insight.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Real reasoning output panel - show actual analysis data */}
                {showInsightPanel && insight && (
                  <div className="mt-2 ml-12 animate-in fade-in slide-in-from-top-1 duration-300">
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2.5">
                      {insight.sectionLabel && (
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {insight.sectionLabel}
                        </p>
                      )}
                      {insight.summary && (
                        <p className="text-sm text-foreground leading-relaxed">
                          {insight.summary}
                        </p>
                      )}
                      {(insight.signalItems?.length ?? 0) > 0 ? (
                        <ul className="space-y-1">
                          {insight.signalItems!.map((item, j) => (
                            <li
                              key={j}
                              className="flex items-start gap-2 text-sm text-foreground"
                            >
                              <span className="text-primary shrink-0 mt-0.5">•</span>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline truncate max-w-full"
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
                            <li
                              key={j}
                              className="flex items-start gap-2 text-sm text-foreground"
                            >
                              <span className="text-primary shrink-0 mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Connector arrow */}
                {i < PIPELINE_STAGES.length - 1 && (
                  <div
                    className={cn(
                      'flex justify-center py-1',
                      status === 'completed' ? 'text-primary/60' : status === 'failed' ? 'text-destructive/40' : 'text-border',
                    )}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
