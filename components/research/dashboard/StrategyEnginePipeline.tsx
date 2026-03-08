'use client'

import { useState } from 'react'
import { Check, Loader2, Circle, ChevronDown, ChevronUp, Sparkles, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
import { getProviderDisplayName } from '@/lib/ai/provider-display'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** AI Analysis Timeline - 7 steps matching real analysis pipeline */
const PIPELINE_STAGES = [
  { id: 'signal_layer', label: '데이터 수집', taskId: 'signal_layer' as const, sectionLabel: '수집된 시그널' },
  { id: 'trend_analysis', label: '시장 성장 분석', taskId: 'trend_analysis' as const, sectionLabel: 'AI 인사이트' },
  { id: 'competition_analysis', label: '경쟁 환경 분석', taskId: 'competition_analysis' as const, sectionLabel: '감지된 경쟁사' },
  { id: 'strategy_generation', label: '리스크 평가', taskId: 'strategy_generation' as const, sectionLabel: '리스크 신호' },
  { id: 'execution_layer', label: '제품 전략 도출', taskId: 'execution_layer' as const, sectionLabel: '제안 전략' },
  { id: 'risks_opportunities', label: '리스크 및 기회 평가', taskId: 'strategy_generation' as const, sectionLabel: '리스크 및 기회', isVirtual: true },
  { id: 'done', label: '분석 완료', taskId: 'done' as const, sectionLabel: '', isVirtual: true },
] as const

const STREAM_TO_INDEX: Record<string, number> = {
  signal_layer: 0,
  news: 0,
  trend_analysis: 1,
  pass1: 1,
  competition_analysis: 2,
  strategy_generation: 3,
  execution_layer: 4,
  pass2: 4,
  creative: 4,
  risks_opportunities: 5,
  done: 6,
}

export interface PipelineStageInsight {
  /** Section header (e.g. "Signals detected", "AI Insight") */
  sectionLabel?: string
  /** Main reasoning paragraph (AI Insight, strategy summary) */
  summary?: string
  /** Bullet points (signals, competitors, risks, actions) */
  signals?: string[]
}

export interface StrategyEnginePipelineProps {
  keyword: string
  /** Backend current step (0–6). -1 = not started. 6 = all done. */
  currentStep: number
  /** When true, all stages show as completed */
  allCompleted?: boolean
  streamingStepId?: string
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
      ? (obj.news_activity as Array<{ title?: string; publisher?: string }>)
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
      case 0:
        // 시장 신호 수집: Show real signals - headlines + sources
        const headlineSignals = news_activity
          .slice(0, 5)
          .map((n) => (n.title ?? '').trim().slice(0, 80))
          .filter(Boolean)
        const sourceSignals = signals?.length ? signals : ['Google News', 'RSS 피드']
        const allSignals = headlineSignals.length > 0
          ? headlineSignals
          : sourceSignals
        return {
          sectionLabel: '수집된 시그널',
          summary: news_activity.length > 0
            ? `${news_activity.length}건 뉴스·시장 데이터 수집 완료`
            : undefined,
          signals: allSignals.slice(0, 5),
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
      return null
    }
  }

  // Fallback from result (history load)
  switch (stageIndex) {
    case 0:
      if (newsList.length > 0) {
        const headlines = newsList.slice(0, 5).map((n) => (n.title ?? '').trim().slice(0, 80)).filter(Boolean)
        const publishers = [...new Set(newsList.map((n) => n.publisher).filter(Boolean))].slice(0, 5) as string[]
        return {
          sectionLabel: '수집된 시그널',
          summary: `${newsList.length}건 시장 데이터 수집`,
          signals: headlines.length > 0 ? headlines : (publishers.length ? publishers : ['Google News', 'RSS 피드']),
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
      return null
  }

  return null
}

export function StrategyEnginePipeline({
  keyword,
  currentStep,
  allCompleted = false,
  streamingStepId,
  retryMessage,
  taskData = {},
  analysisTasks = null,
  newsList = [],
  onRetryStep,
  hasError = false,
  errorStepIndex = 0,
  globalErrorMessage,
  result,
  className,
}: StrategyEnginePipelineProps) {
  const [expanded, setExpanded] = useState(false)
  type TaskItem = NonNullable<typeof analysisTasks> extends (infer U)[] ? U : never
  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => { acc[t.step_name] = t; return acc },
    {} as Record<string, TaskItem>
  )

  const effectiveIndex = allCompleted
    ? 6
    : streamingStepId && STREAM_TO_INDEX[streamingStepId] != null
      ? STREAM_TO_INDEX[streamingStepId]
      : currentStep >= 0
        ? currentStep
        : 0

  type StageStatus = 'pending' | 'running' | 'completed' | 'failed'
  function getStatus(i: number): StageStatus {
    const stage = PIPELINE_STAGES[i]
    const taskId = stage?.taskId
    const task = taskId && taskId !== 'done' ? taskMap[taskId] : null
    // Virtual steps: 5 = risks_opportunities (done when strategy_generation done), 6 = done (allCompleted)
    if (i === 5) {
      const stratTask = taskMap['strategy_generation']
      return stratTask?.status === 'completed' || allCompleted ? 'completed' : stratTask?.status === 'running' ? 'running' : 'pending'
    }
    if (i === 6) return allCompleted ? 'completed' : 'pending'
    // Global error: failed step + completed before + pending after
    if (hasError) {
      const failIdx = Math.min(errorStepIndex, 4)
      if (i === failIdx) return 'failed'
      if (i < failIdx) return 'completed'
      return 'pending'
    }
    if (task) return task.status
    if (i < effectiveIndex) return 'completed'
    if (i === effectiveIndex && !allCompleted) return 'running'
    return 'pending'
  }

  const currentIdx = allCompleted ? 6 : Math.min(effectiveIndex, 5)
  const currentStage = PIPELINE_STAGES[currentIdx] ?? PIPELINE_STAGES[5]

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm overflow-hidden',
        'bg-gradient-to-b from-primary/5 to-transparent',
        className
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                AI 분석 진행 상황
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {allCompleted ? `분석 완료 · "${keyword}"` : `AI가 단계별로 분석 중 · "${keyword}"`}
              </p>
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
          <div className="space-y-3 mb-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {PIPELINE_STAGES.slice(0, 6).map((s, i) => {
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
                'rounded-lg border-2 px-4 py-3',
                getStatus(currentIdx) === 'completed' && 'border-primary/50 bg-primary/5',
                getStatus(currentIdx) === 'running' && 'border-primary bg-primary/10 ring-2 ring-primary/20',
                getStatus(currentIdx) === 'pending' && 'border-border/60 bg-muted/20',
                getStatus(currentIdx) === 'failed' && 'border-destructive/50 bg-destructive/5',
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    getStatus(currentIdx) === 'completed' && 'bg-primary text-primary-foreground',
                    getStatus(currentIdx) === 'running' && 'bg-primary/20 text-primary',
                    getStatus(currentIdx) === 'pending' && 'bg-muted text-muted-foreground',
                    getStatus(currentIdx) === 'failed' && 'bg-destructive/20 text-destructive',
                  )}
                >
                  {getStatus(currentIdx) === 'completed' && <Check className="h-4 w-4" strokeWidth={2.5} />}
                  {getStatus(currentIdx) === 'running' && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
                  {getStatus(currentIdx) === 'pending' && <Circle className="h-3.5 w-3.5" strokeWidth={2} />}
                  {getStatus(currentIdx) === 'failed' && <AlertCircle className="h-4 w-4" strokeWidth={2} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{currentStage?.label ?? '분석 완료'}</p>
                  {getStatus(currentIdx) === 'running' && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getAnalysisActivityMessage(currentStage?.id ?? 'done', currentIdx, { short: true })}
                    </p>
                  )}
                  {getStatus(currentIdx) === 'completed' && allCompleted && (
                    <p className="text-xs text-muted-foreground mt-0.5">모든 분석이 완료되었습니다</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Expanded: full timeline with max-height scroll */}
        <div
          className={cn(
            'relative',
            expanded ? 'max-h-[420px] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20' : 'hidden',
          )}
        >
          {PIPELINE_STAGES.map((stage, i) => {
            const status = getStatus(i)
            const analysisTask = taskMap[stage.id] ?? null
            const insight =
              (status === 'completed' || status === 'running')
                ? getStageInsight(i, taskData, analysisTask, result, newsList)
                : null
            const hasInsight = insight && (insight.summary || (insight.signals?.length ?? 0) > 0)
            const showInsightPanel = hasInsight && (status === 'completed' || status === 'running')
            const task = taskMap[stage.id]

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
                      'border-destructive/50 bg-destructive/5',
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
                        모델 상태: {task
                          ? (() => {
                              const t = task as { provider?: string | null; fallback_used?: boolean; primary_provider_error?: string | null }
                              if (t.fallback_used && t.primary_provider_error) {
                                const errKo = t.primary_provider_error === 'quota exceeded' ? '쿼터 초과' : t.primary_provider_error === 'timeout' ? '타임아웃' : t.primary_provider_error === 'network error' ? '네트워크 오류' : t.primary_provider_error.replace(/_/g, ' ')
                                const primary = t.provider === 'groq' ? 'Gemini' : 'Groq'
                                const fallback = t.provider === 'groq' ? 'Groq' : 'Gemini'
                                return `${primary} → 실패 (${errKo})\n${fallback} → ${status === 'completed' ? '성공' : '실행 중'}`
                              }
                              return getProviderDisplayName(t.provider ?? null, t.fallback_used) || '—'
                            })()
                          : '—'}
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
                                {((task as { provider?: string }).provider) === 'groq' ? 'Gemini' : 'Groq'} {(() => {
                                  const err = (task as { primary_provider_error?: string }).primary_provider_error
                                  return err === 'quota exceeded' ? '쿼터 초과' : err === 'timeout' ? '타임아웃' : err === 'network error' ? '네트워크 오류' : err?.replace(/_/g, ' ') ?? ''
                                })()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                              {((task as { provider?: string }).provider) === 'groq' ? 'Groq' : 'Gemini'}로 재시도 중...
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {retryMessage && i === effectiveIndex
                              ? retryMessage
                              : getAnalysisActivityMessage(stage.id, i, { short: true })}
                          </p>
                        )}
                      </div>
                    )}
                    {status === 'failed' && (
                      <div className="mt-1 space-y-2">
                        <p className="text-xs text-destructive font-medium">
                          오류: {task?.error_message ?? globalErrorMessage ?? '오류 발생'}
                        </p>
                        {(task?.error_message ?? globalErrorMessage) && /quota|429|rate limit|한도|초과|혼잡/i.test((task?.error_message ?? globalErrorMessage) ?? '') && (
                          <p className="text-xs text-muted-foreground">재시도가 필요할 수 있습니다.</p>
                        )}
                        {onRetryStep && (
                          <Button variant="outline" size="sm" onClick={onRetryStep} className="gap-1.5 h-8 text-xs">
                            <RefreshCw className="h-3.5 w-3.5" />
                            단계 재시도
                          </Button>
                        )}
                      </div>
                    )}
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
                      {insight.signals && insight.signals.length > 0 && (
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
                      )}
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
