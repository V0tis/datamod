'use client'

import { Cpu } from 'lucide-react'
import { getProviderDisplayName, getPrimaryModelDisplayName, getFallbackModelDisplayName } from '@/lib/ai/provider-display'
import { cn } from '@/lib/utils'

const STEP_LABELS: Record<string, string> = {
  signal_layer: '시장 신호 수집',
  trend_analysis: '시장 성장 분석',
  competition_analysis: '경쟁 환경 분석',
  strategy_generation: '리스크 평가',
  execution_layer: '제품 전략 도출',
}

const STEP_ORDER = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'strategy_generation',
  'execution_layer',
] as const

export interface AnalysisEngineSectionProps {
  /** From polled analysis_tasks; each may have provider, fallback_used, primary_provider_error */
  analysisTasks?: Array<{
    step_name: string
    status: string
    provider?: string | null
    fallback_used?: boolean
    primary_provider_error?: string | null
  }> | null
  className?: string
}

export function AnalysisEngineSection({
  analysisTasks = null,
  className,
}: AnalysisEngineSectionProps) {
  const tasks = analysisTasks ?? []
  const byStep = new Map(tasks.map((t) => [t.step_name, t]))

  return (
    <section
      className={cn(
        'rounded-lg border border-border/60 bg-muted/10 overflow-hidden',
        className
      )}
      aria-label="AI 분석 엔진"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
        <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          AI 분석 엔진
        </h2>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Primary Model
            </p>
            <p className="font-medium text-foreground">
              {getPrimaryModelDisplayName()}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Fallback Model
            </p>
            <p className="font-medium text-foreground">
              {getFallbackModelDisplayName()}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Analysis Models Used
          </p>
          <ul className="space-y-1.5">
            {STEP_ORDER.map((stepName) => {
              const task = byStep.get(stepName)
              const label = STEP_LABELS[stepName] ?? stepName
              const displayName = task
                ? getProviderDisplayName(task.provider ?? null, task.fallback_used, task.primary_provider_error)
                : '—'
              return (
                <li
                  key={stepName}
                  className="flex items-center justify-between gap-2 text-sm text-foreground py-1"
                >
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium tabular-nums">{displayName || '—'}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
