'use client'

import { useState } from 'react'
import { Check, Loader2, Circle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/** User-facing stage labels for AI reasoning visibility */
const STAGES = [
  {
    id: 'signal_layer',
    label: 'Analyzing Market Signals',
    subSteps: [
      'Collecting Google Trends data',
      'Extracting Reddit discussions',
      'Scanning Product Hunt launches',
      'Evaluating VC funding signals',
      'Identifying emerging keywords',
    ],
  },
  { id: 'trend_analysis', label: 'Analyzing growth trends', subSteps: [] },
  { id: 'competition_analysis', label: 'Mapping competition landscape', subSteps: [] },
  { id: 'strategy_generation', label: 'Evaluating risks & opportunities', subSteps: [] },
  { id: 'execution_layer', label: 'Generating strategic insights', subSteps: [] },
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

export type StageStatus = 'pending' | 'loading' | 'generating' | 'completed'

export interface AIAnalysisTimelineProps {
  /** Current backend step (0–4). -1 = not started */
  currentStep: number
  /** Backend streaming step id (signal_layer, trend_analysis, etc.) */
  streamingStepId?: string | null
  /** When true, all stages are done; timeline can collapse */
  allCompleted?: boolean
  /** Optional: polled task status for real backend state */
  analysisTasks?: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
  }> | null
  /** Collapsed by default when all done; user can expand */
  defaultCollapsed?: boolean
  className?: string
}

export function AIAnalysisTimeline({
  currentStep,
  streamingStepId,
  allCompleted = false,
  analysisTasks = null,
  defaultCollapsed = true,
  className,
}: AIAnalysisTimelineProps) {
  const [expanded, setExpanded] = useState(!defaultCollapsed)

  const effectiveStep =
    streamingStepId && STREAM_TO_INDEX[streamingStepId] != null
      ? STREAM_TO_INDEX[streamingStepId]
      : currentStep >= 0
        ? currentStep
        : 0

  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => {
      acc[t.step_name] = t.status
      return acc
    },
    {} as Record<string, string>
  )

  const getStatus = (i: number): StageStatus => {
    const stage = STAGES[i]
    const taskStatus = stage ? taskMap[stage.id] : null
    if (taskStatus === 'completed') return 'completed'
    if (taskStatus === 'running') return 'generating'
    if (i < effectiveStep) return 'completed'
    if (i === effectiveStep && !allCompleted) return 'generating'
    return 'pending'
  }

  const isCollapsed = allCompleted && !expanded
  const canExpandCollapse = allCompleted

  return (
    <section
      className={cn(
        'rounded-lg border border-border/60 bg-muted/10 overflow-hidden transition-all duration-300',
        className
      )}
      aria-label="AI Analysis Timeline"
    >
      {/* Header: always visible */}
      <button
        type="button"
        onClick={() => canExpandCollapse && setExpanded((e) => !e)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3 text-left',
          canExpandCollapse && 'hover:bg-muted/30 transition-colors cursor-pointer'
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            AI Analysis Timeline
          </h2>
          {allCompleted && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              Complete
            </span>
          )}
        </div>
        {canExpandCollapse && (
          <span className="text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
      </button>

      {/* Timeline body: expandable when complete */}
      <div
        className={cn(
          'transition-all duration-300 ease-out overflow-hidden',
          isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[800px] opacity-100'
        )}
      >
        <div className="px-4 pb-4 pt-0">
          <div className="relative pl-5">
            {/* Vertical line */}
            <div
              className="absolute left-[5px] top-2 bottom-2 w-px bg-border/80"
              aria-hidden
            />

            {STAGES.map((stage, i) => {
              const status = getStatus(i)
              const isLast = i === STAGES.length - 1

              return (
                <div
                  key={stage.id}
                  className={cn(
                    'relative flex gap-3 pb-5 transition-opacity duration-300',
                    !isLast && 'min-h-[36px]',
                    status === 'pending' && 'opacity-50'
                  )}
                >
                  {/* Step indicator */}
                  <div
                    className={cn(
                      'absolute left-0 z-10 flex h-[18px] w-[18px] shrink-0 -translate-x-[7px] items-center justify-center rounded-full border-2 transition-all duration-300',
                      status === 'completed' &&
                        'border-primary bg-primary text-primary-foreground',
                      (status === 'loading' || status === 'generating') &&
                        'border-primary bg-primary/15 text-primary',
                      status === 'pending' &&
                        'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {status === 'completed' && (
                      <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
                    )}
                    {(status === 'loading' || status === 'generating') && (
                      <Loader2
                        className="h-2.5 w-2.5 animate-spin"
                        strokeWidth={2}
                      />
                    )}
                    {status === 'pending' && (
                      <Circle className="h-1.5 w-1.5" strokeWidth={2} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        status === 'completed' && 'text-foreground',
                        (status === 'loading' || status === 'generating') &&
                          'text-foreground',
                        status === 'pending' && 'text-muted-foreground'
                      )}
                    >
                      {status === 'completed' ? (
                        <>✓ {stage.label}</>
                      ) : (status === 'loading' || status === 'generating') ? (
                        <>{stage.label}...</>
                      ) : (
                        stage.label
                      )}
                    </div>

                    {/* Sub-steps (e.g. for signal_layer) */}
                    {stage.subSteps.length > 0 &&
                      (status === 'generating' ||
                        status === 'loading' ||
                        status === 'completed') && (
                        <ul className="mt-2 space-y-1 pl-0">
                          {stage.subSteps.map((sub, j) => {
                            const subCompleted =
                              status === 'completed' ||
                              (status === 'generating' &&
                                j < stage.subSteps.length - 1)
                            return (
                              <li
                                key={j}
                                className={cn(
                                  'flex items-center gap-2 text-xs transition-opacity duration-200',
                                  subCompleted
                                    ? 'text-muted-foreground'
                                    : 'text-muted-foreground/70'
                                )}
                              >
                                {subCompleted ? (
                                  <Check className="h-3 w-3 shrink-0 text-primary/80" />
                                ) : (
                                  <Circle className="h-2 w-2 shrink-0 text-muted-foreground/50" />
                                )}
                                <span>{sub}</span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
