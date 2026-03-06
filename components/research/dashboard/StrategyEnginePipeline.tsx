'use client'

import { Check, Loader2, Circle, ChevronDown, Sparkles, AlertCircle } from 'lucide-react'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
import { cn } from '@/lib/utils'

/** AI Analysis Timeline - 5 PM strategy steps with real reasoning output */
const PIPELINE_STAGES = [
  { id: 'signal_layer', label: '시장 신호 수집', taskId: 'signal_layer' as const, sectionLabel: 'Signals detected' },
  { id: 'trend_analysis', label: '시장 성장 분석', taskId: 'trend_analysis' as const, sectionLabel: 'AI Insight' },
  { id: 'competition_analysis', label: '경쟁 환경 분석', taskId: 'competition_analysis' as const, sectionLabel: 'Detected competitors' },
  { id: 'strategy_generation', label: '리스크 평가', taskId: 'strategy_generation' as const, sectionLabel: 'Risk signals' },
  { id: 'execution_layer', label: '제품 전략 도출', taskId: 'execution_layer' as const, sectionLabel: 'Suggested Strategy' },
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
  done: 4,
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
  /** Backend current step (0–4). -1 = not started. 4 = all done. */
  currentStep: number
  /** When true, all stages show as completed */
  allCompleted?: boolean
  streamingStepId?: string
  taskData?: Partial<Record<string, unknown>>
  /** Polled task status from backend (real state) */
  analysisTasks?: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    output_data: unknown
    error_message: string | null
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
          sectionLabel: 'Signals detected',
          summary: news_activity.length > 0
            ? `${news_activity.length}건 뉴스·시장 데이터 수집 완료`
            : undefined,
          signals: allSignals.slice(0, 5),
        }
      case 1:
        return {
          sectionLabel: 'AI Insight',
          summary: trend_summary,
          signals: growth_signals?.slice(0, 5),
        }
      case 2:
        return {
          sectionLabel: 'Detected competitors',
          summary: typeof obj.market_structure === 'string' ? obj.market_structure : undefined,
          signals: compSignals.slice(0, 6),
        }
      case 3:
        return {
          sectionLabel: 'Risk signals',
          summary: strategy_summary,
          signals: [...risks.slice(0, 4), ...opportunities.slice(0, 2)].filter(Boolean).slice(0, 6),
        }
      case 4:
        const execSignals = [
          ...actionSignals,
          ...feature_ideas.slice(0, 3),
          ...go_to_market.slice(0, 2),
        ].filter(Boolean)
        const strategySummary = actionSignals[0]
          ? `Target early adopters: ${actionSignals[0]}`
          : feature_ideas[0]
            ? `Core value: ${feature_ideas[0]}`
            : execSignals.length > 0
              ? `${execSignals.length}개 전략 액션 도출`
              : undefined
        return {
          sectionLabel: 'Suggested Strategy',
          summary: strategySummary,
          signals: execSignals.slice(0, 5),
        }
    }
  }

  // Fallback from result (history load)
  switch (stageIndex) {
    case 0:
      if (newsList.length > 0) {
        const headlines = newsList.slice(0, 5).map((n) => (n.title ?? '').trim().slice(0, 80)).filter(Boolean)
        const publishers = [...new Set(newsList.map((n) => n.publisher).filter(Boolean))].slice(0, 5) as string[]
        return {
          sectionLabel: 'Signals detected',
          summary: `${newsList.length}건 시장 데이터 수집`,
          signals: headlines.length > 0 ? headlines : (publishers.length ? publishers : ['Google News', 'RSS 피드']),
        }
      }
      return null
    case 1:
      return {
        sectionLabel: 'AI Insight',
        summary: km.summary_insights ?? result?.marketNews?.[0],
        signals: (km.positive_signals ?? result?.marketNews ?? []).slice(0, 4),
      }
    case 2:
      return {
        sectionLabel: 'Detected competitors',
        summary: result?.competitorTrends,
        signals: (km.neutral_signals ?? []).slice(0, 4),
      }
    case 3:
      const pos = km.positive_signals ?? []
      const neg = km.negative_risks ?? result?.painPoints ?? []
      return {
        sectionLabel: 'Risk signals',
        summary: pos.length || neg.length ? `${pos.length}개 기회, ${neg.length}개 리스크` : undefined,
        signals: [...neg.slice(0, 4), ...pos.slice(0, 2)].filter(Boolean),
      }
    case 4:
      const actions = km.pm_actions?.recommended_actions ?? []
      return {
        sectionLabel: 'Suggested Strategy',
        summary: actions.length ? `${actions.length}개 전략 액션 도출` : undefined,
        signals: actions.slice(0, 4).map((a) => a?.title ?? '').filter(Boolean),
      }
  }

  return null
}

export function StrategyEnginePipeline({
  keyword,
  currentStep,
  allCompleted = false,
  streamingStepId,
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
  type TaskItem = NonNullable<typeof analysisTasks> extends (infer U)[] ? U : never
  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => { acc[t.step_name] = t; return acc },
    {} as Record<string, TaskItem>
  )

  const effectiveIndex = allCompleted
    ? 5
    : streamingStepId && STREAM_TO_INDEX[streamingStepId] != null
      ? STREAM_TO_INDEX[streamingStepId]
      : currentStep >= 0
        ? currentStep
        : 0

  type StageStatus = 'pending' | 'running' | 'completed' | 'failed'
  const getStatus = (i: number): StageStatus => {
    const stage = PIPELINE_STAGES[i]
    const task = stage ? taskMap[stage.id] : null
    // Global error: failed step + completed before + pending after
    if (hasError) {
      if (i === errorStepIndex) return 'failed'
      if (i < errorStepIndex) return 'completed'
      return 'pending'
    }
    if (task) return task.status
    if (i < effectiveIndex) return 'completed'
    if (i === effectiveIndex && !allCompleted) return 'running'
    return 'pending'
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm overflow-hidden',
        'bg-gradient-to-b from-primary/5 to-transparent',
        className
      )}
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              AI Analysis Timeline
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI strategist thinking step by step · &quot;{keyword}&quot;
            </p>
          </div>
        </div>

        <div className="relative">
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
                      Step {i + 1} · {stage.label}
                    </h3>
                    {status === 'running' && !hasInsight && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {getAnalysisActivityMessage(stage.id, i, { short: true })}
                      </p>
                    )}
                    {status === 'failed' && (
                      <p className="text-xs text-destructive mt-1">
                        {task?.error_message ?? globalErrorMessage ?? '오류 발생'}
                      </p>
                    )}
                    {hasInsight && (status === 'completed' || status === 'running') && insight?.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {insight.summary}
                      </p>
                    )}
                    {status === 'failed' && onRetryStep && (
                      <button
                        type="button"
                        onClick={onRetryStep}
                        className="mt-2 text-xs font-medium text-primary hover:underline"
                      >
                        다시 시도
                      </button>
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
