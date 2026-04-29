'use client'

import { Cpu, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
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

function getProviderStatusDisplay(
  task: { provider?: string | null; fallback_used?: boolean; primary_provider_error?: string | null; status?: string } | undefined,
  aiPrimaryModel: 'gemini' | 'groq'
): { primary: string; fallback: string } {
  if (!task) {
    return {
      primary: `${aiPrimaryModel === 'gemini' ? 'Gemini' : 'Groq'} → 실행되지 않음`,
      fallback: `${aiPrimaryModel === 'gemini' ? 'Groq' : 'Gemini'} → 실행되지 않음`,
    }
  }
  const primaryName = aiPrimaryModel === 'gemini' ? 'Gemini' : 'Groq'
  const fallbackName = aiPrimaryModel === 'gemini' ? 'Groq' : 'Gemini'
  if (task.fallback_used) {
    return {
      primary: `${primaryName} → 실패`,
      fallback: `${fallbackName} → 대체 실행 → 성공`,
    }
  }
  if (task.status === 'completed' && !task.fallback_used) {
    return {
      primary: `${primaryName} → 성공`,
      fallback: `${fallbackName} → 실행되지 않음`,
    }
  }
  return {
    primary: `${primaryName} → 실행되지 않음`,
    fallback: `${fallbackName} → 실행되지 않음`,
  }
}

export interface AnalysisEngineSectionProps {
  /** Hide the section header when embedded in collapsible */
  hideHeader?: boolean
  /** From polled analysis_tasks; each may have provider, fallback_used, primary_provider_error */
  analysisTasks?: Array<{
    step_name: string
    status: string
    provider?: string | null
    fallback_used?: boolean
    primary_provider_error?: string | null
  }> | null
  /** 사용자 설정 AI 우선 모델 */
  aiPrimaryModel?: 'gemini' | 'groq'
  className?: string
}

export function AnalysisEngineSection({
  analysisTasks = null,
  aiPrimaryModel = 'gemini',
  hideHeader = false,
  className,
}: AnalysisEngineSectionProps) {
  const tasks = analysisTasks ?? []
  const byStep = new Map(tasks.map((t) => [t.step_name, t]))
  const fallbackUsedTask = tasks.find((t) => t.fallback_used && t.status === 'completed')
  const sampleTask = fallbackUsedTask ?? tasks.find((t) => t.status === 'completed') ?? null
  const statusDisplay = getProviderStatusDisplay(sampleTask ?? undefined, aiPrimaryModel)

  return (
    <section
      className={cn(
        'rounded-lg border border-border/60 bg-muted/10 overflow-hidden',
        className
      )}
      aria-label="AI 분석 엔진"
    >
      {!hideHeader && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60">
          <Cpu className="h-4 w-4 text-muted-foreground shrink-0" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            AI 분석 엔진
          </h2>
        </div>
      )}
      <div className="p-4 space-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            우선 분석 모델: {aiPrimaryModel === 'gemini' ? 'Gemini' : 'Groq'}
          </p>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              {statusDisplay.primary.includes('성공') ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : statusDisplay.primary.includes('실패') ? (
                <XCircle className="h-4 w-4 text-destructive shrink-0" />
              ) : (
                <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>{statusDisplay.primary}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              {statusDisplay.fallback.includes('성공') ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              ) : statusDisplay.fallback.includes('실행되지 않음') ? (
                <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <MinusCircle className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span>{statusDisplay.fallback}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
            단계별 분석 모델
          </p>
          <ul className="space-y-1.5">
            {STEP_ORDER.map((stepName) => {
              const task = byStep.get(stepName)
              const label = STEP_LABELS[stepName] ?? stepName
              const display = task
                ? getProviderStatusDisplay(task, aiPrimaryModel)
                : null
              const showFallback = task?.fallback_used
              return (
                <li
                  key={stepName}
                  className="flex flex-col gap-0.5 text-sm text-foreground py-1.5 border-b border-border/40 last:border-0"
                >
                  <span className="text-muted-foreground">{label}</span>
                  {display ? (
                    <div className="text-xs space-y-0.5">
                      <span className={task?.status === 'completed' ? 'text-foreground' : 'text-muted-foreground'}>
                        {display.primary}
                      </span>
                      {showFallback && (
                        <span className="text-emerald-600  block">
                          {display.fallback}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
