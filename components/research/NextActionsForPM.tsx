'use client'

import { CheckSquare2, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { SectionContentSkeleton } from './SectionContentSkeleton'

export type NextActionItem = {
  action: string
  why?: string
  how_to_execute?: string
  priority?: 'high' | 'medium' | 'low'
  estimated_effort?: string
}

const PRIORITY_COLORS = {
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-500 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
} as const

export interface NextActionsForPMProps {
  result: ResearchResponse | null
  loading?: boolean
}

/** Derive NextActionItem from pm_action_plan for backward compatibility */
function fromPmActionPlan(km: NonNullable<ResearchResponse['key_metrics']>): NextActionItem[] {
  const plan = km.pm_action_plan ?? []
  const actions = km.pm_actions?.recommended_actions ?? []
  if (plan.length > 0) {
    return plan.slice(0, 5).map((a) => ({
      action: a.action_title,
      why: a.expected_outcome,
      how_to_execute: a.description,
      priority: (a.priority ?? 'medium') as 'high' | 'medium' | 'low',
      estimated_effort: undefined,
    }))
  }
  if (actions.length > 0) {
    return actions.slice(0, 5).map((a) => ({
      action: a.title,
      why: a.reasoning,
      how_to_execute: undefined,
      priority: (a.urgency_level ?? 'medium') as 'high' | 'medium' | 'low',
      estimated_effort: undefined,
    }))
  }
  return []
}

export function NextActionsForPM({ result, loading = false }: NextActionsForPMProps) {
  const km = result?.key_metrics ?? {}
  const nextActions: NextActionItem[] =
    Array.isArray(km.next_actions_pm) && km.next_actions_pm.length > 0
      ? km.next_actions_pm
          .filter((a): a is typeof a & { action: string } => !!a.action?.trim())
          .slice(0, 5)
          .map((a) => ({
            action: a.action,
            why: a.why,
            how_to_execute: a.how_to_execute,
            priority: a.priority,
            estimated_effort: a.estimated_effort,
          }))
      : fromPmActionPlan(km)

  const hasContent = nextActions.length > 0

  return (
    <section
      id="section-next-actions-pm"
      className="scroll-mt-24 rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <CheckSquare2 className="h-5 w-5 text-primary" />
          Next Actions for PM
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          실행 가능한 5가지 PM 액션 (왜, 어떻게, 우선순위, 예상 공수)
        </p>
      </div>
      {loading && !hasContent ? (
        <div className="p-4 sm:p-5">
          <SectionContentSkeleton variant="list" />
        </div>
      ) : !hasContent ? (
        <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-3">
          <CheckSquare2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            AI가 액션 플랜을 생성하지 못했습니다.
          </p>
          <p className="text-xs text-muted-foreground/70">
            분석을 다시 실행하면 더 나은 결과를 얻을 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {nextActions.map((item, i) => (
            <div key={i} className="px-4 sm:px-5 py-4 hover:bg-muted/30 transition-colors">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  {item.action}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  {item.priority && (
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border',
                        PRIORITY_COLORS[item.priority] ?? PRIORITY_COLORS.medium
                      )}
                    >
                      {item.priority}
                    </span>
                  )}
                  {item.estimated_effort && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {item.estimated_effort}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm pl-8">
                {item.why && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                      Why
                    </p>
                    <p className="text-foreground leading-relaxed">{item.why}</p>
                  </div>
                )}
                {item.how_to_execute && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      How to execute
                    </p>
                    <p className="text-foreground leading-relaxed">{item.how_to_execute}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
