'use client'

import { Check, Loader2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Product Strategy Engine - 5 PM market analysis tasks (AI Analysis Timeline) */
const STEPS = [
  { id: 'signal_layer', label: '시장 신호 수집' },
  { id: 'trend_analysis', label: '시장 성장 분석' },
  { id: 'competition_analysis', label: '경쟁 환경 매핑' },
  { id: 'strategy_generation', label: '리스크 평가' },
  { id: 'execution_layer', label: '제품 전략 도출' },
] as const

/** Maps engine stage/event to timeline step index */
export const STREAM_TO_TIMELINE: Record<string, number> = {
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

export interface TimelineStepData {
  aiInsight?: string
  signals?: string[]
}

export interface AnalysisTimelineProps {
  currentStep: number
  streamingStepId?: string
  /** Per-task data from backend (task ID -> partial result) */
  taskData?: Partial<Record<string, unknown>>
  stepData?: Partial<Record<number, TimelineStepData>>
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
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

export function AnalysisTimeline({
  currentStep,
  streamingStepId,
  taskData = {},
  stepData = {},
  newsList = [],
  result,
  className,
}: AnalysisTimelineProps) {
  const effectiveStep =
    streamingStepId && STREAM_TO_TIMELINE[streamingStepId] != null
      ? STREAM_TO_TIMELINE[streamingStepId]
      : currentStep

  const getStepStatus = (i: number): 'pending' | 'running' | 'completed' => {
    if (i < effectiveStep) return 'completed'
    if (i === effectiveStep) return 'running'
    return 'pending'
  }

  const getStepContent = (i: number): TimelineStepData | null => {
    const taskId = STEPS[i]?.id
    const custom = stepData[i]
    if (custom && (custom.aiInsight || (custom.signals?.length ?? 0) > 0))
      return custom

    // Prefer task data from backend (Product Strategy Engine layers)
    const td = taskId ? taskData[taskId] : null
    if (td && typeof td === 'object') {
      const obj = td as Record<string, unknown>
      const signals = Array.isArray(obj.signals) ? obj.signals.filter((s): s is string => typeof s === 'string') : undefined
      const trend_summary = typeof obj.trend_summary === 'string' ? obj.trend_summary : typeof obj.summary === 'string' ? obj.summary : undefined
      const growth_signals = Array.isArray(obj.growth_signals) ? obj.growth_signals.filter((s): s is string => typeof s === 'string') : Array.isArray(obj.insights) ? obj.insights.filter((s): s is string => typeof s === 'string') : undefined
      const competitive_landscape = Array.isArray(obj.competitive_landscape) ? obj.competitive_landscape : []
      const compSignals = competitive_landscape
        .slice(0, 5)
        .map((c) => (typeof c === 'object' && c && typeof (c as { name?: string }).name === 'string' ? (c as { name: string }).name : ''))
        .filter(Boolean)
      const opportunities = Array.isArray(obj.opportunities) ? obj.opportunities.filter((s): s is string => typeof s === 'string') : []
      const risks = Array.isArray(obj.risks) ? obj.risks.filter((s): s is string => typeof s === 'string') : []
      const strategy_summary = typeof obj.strategy_summary === 'string' ? obj.strategy_summary : undefined
      const product_actions = Array.isArray(obj.product_actions) ? obj.product_actions : []
      const actionSignals = product_actions
        .slice(0, 3)
        .map((a) => (typeof a === 'object' && a && typeof (a as { action?: string }).action === 'string' ? (a as { action: string }).action : ''))
        .filter(Boolean)
      const feature_ideas = Array.isArray(obj.feature_ideas) ? obj.feature_ideas.filter((s): s is string => typeof s === 'string') : []
      const go_to_market_steps = Array.isArray(obj.go_to_market_steps) ? obj.go_to_market_steps.filter((s): s is string => typeof s === 'string') : []

      switch (i) {
        case 0:
          return { aiInsight: signals?.length ? `${signals.length}개 시장 신호 수집 완료` : undefined, signals }
        case 1:
          return { aiInsight: trend_summary, signals: growth_signals && growth_signals.length > 0 ? growth_signals : undefined }
        case 2:
          return {
            aiInsight: obj.market_structure && typeof obj.market_structure === 'string' ? obj.market_structure : compSignals.length ? `${compSignals.length}개 경쟁사 식별` : undefined,
            signals: compSignals.length > 0 ? compSignals : undefined,
          }
        case 3:
          return {
            aiInsight: strategy_summary ?? (opportunities.length || risks.length ? `${opportunities.length}개 기회, ${risks.length}개 리스크` : undefined),
            signals: [...opportunities.slice(0, 2), ...risks.slice(0, 2)].filter(Boolean),
          }
        case 4:
          const execSignals = [...actionSignals, ...feature_ideas.slice(0, 2), ...go_to_market_steps.slice(0, 2)].filter(Boolean)
          return {
            aiInsight: actionSignals.length || feature_ideas.length ? `${actionSignals.length}개 액션, ${feature_ideas.length}개 피처 아이디어` : undefined,
            signals: execSignals.length > 0 ? execSignals : undefined,
          }
      }
    }

    // Fallback: derive from result (when loading from history)
    const km = result?.key_metrics ?? {}
    switch (i) {
      case 0:
        if (newsList.length > 0) {
          const publishers = [...new Set(newsList.map((n) => n.publisher).filter(Boolean))].slice(0, 5)
          return {
            aiInsight: `${newsList.length}건의 시장 데이터를 수집했습니다.`,
            signals: publishers.length > 0 ? (publishers as string[]) : ['Google News', 'RSS 피드'],
          }
        }
        return null
      case 1:
        return {
          aiInsight: km.summary_insights ?? result?.marketNews?.[0],
          signals: (km.positive_signals ?? result?.marketNews ?? []).slice(0, 3).filter(Boolean),
        }
      case 2:
        return {
          aiInsight: result?.competitorTrends,
          signals: (km.neutral_signals ?? []).slice(0, 3),
        }
      case 3:
        const pos = km.positive_signals ?? []
        const neg = km.negative_risks ?? result?.painPoints ?? []
        return {
          aiInsight: pos.length || neg.length ? `${pos.length}개 기회, ${neg.length}개 리스크` : undefined,
          signals: [...pos.slice(0, 2), ...neg.slice(0, 2)].filter(Boolean),
        }
      case 4:
        const actions = km.pm_actions?.recommended_actions ?? []
        return {
          aiInsight: actions.length ? `${actions.length}개 전략 액션` : undefined,
          signals: actions.slice(0, 3).map((a) => a.title ?? '').filter(Boolean),
        }
      default:
        return null
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-muted/20 px-5 py-6',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-6">
        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          AI 분석 타임라인
        </h2>
      </div>
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-[11px] top-6 bottom-6 w-px bg-border/80"
          aria-hidden
        />

        {STEPS.map((step, i) => {
          const status = getStepStatus(i)
          const content = (status === 'running' || status === 'completed') ? getStepContent(i) : null

          return (
            <div
              key={step.id}
              className={cn(
                'relative flex gap-4 pl-0 pb-8 last:pb-0 transition-all duration-300',
                status === 'pending' && 'opacity-60',
              )}
            >
              {/* Step indicator */}
              <div
                className={cn(
                  'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300',
                  status === 'completed' && 'border-primary bg-primary text-primary-foreground',
                  status === 'running' && 'border-primary bg-primary/10 text-primary',
                  status === 'pending' && 'border-muted-foreground/30 bg-muted/50 text-muted-foreground',
                )}
              >
                {status === 'completed' && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {status === 'running' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                )}
                {status === 'pending' && <Circle className="h-2.5 w-2.5" strokeWidth={2} />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    Step {i + 1}
                  </span>
                  <h3
                    className={cn(
                      'text-sm font-semibold',
                      status === 'completed' && 'text-foreground',
                      status === 'running' && 'text-foreground',
                      status === 'pending' && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </h3>
                </div>
                <div
                  className={cn(
                    'mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider',
                    status === 'completed' && 'text-primary/80',
                    status === 'running' && 'text-primary',
                  )}
                >
                  {status === 'completed' && '완료'}
                  {status === 'running' && '진행 중'}
                  {status === 'pending' && '대기'}
                </div>

                {content && (content.aiInsight || (content.signals?.length ?? 0) > 0) && (
                  <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {content.aiInsight && (
                      <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          AI 인사이트
                        </p>
                        <p className="text-sm text-foreground leading-relaxed">
                          {content.aiInsight}
                        </p>
                      </div>
                    )}
                    {content.signals && content.signals.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1.5">신호</p>
                        <ul className="space-y-1">
                          {content.signals.map((s, j) => (
                            <li
                              key={j}
                              className="flex items-start gap-2 text-sm text-foreground"
                            >
                              <span className="text-muted-foreground mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
