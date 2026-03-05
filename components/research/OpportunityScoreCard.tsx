'use client'

import { Target, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const BREAKDOWN_LABELS: Record<string, string> = {
  market_growth: '시장 성장',
  competition_pressure: '경쟁 압박',
  user_demand: '사용자 수요',
  product_differentiation: '제품 차별화',
  market_timing: '시장 타이밍',
}

export interface OpportunityScoreCardProps {
  score: number | null
  breakdown?: {
    market_growth?: number
    competition_pressure?: number
    user_demand?: number
    product_differentiation?: number
    market_timing?: number
  } | null
  reasoning?: string | null
  loading?: boolean
  className?: string
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-500'
  if (score >= 50) return 'text-amber-600 dark:text-amber-500'
  return 'text-rose-600 dark:text-rose-500'
}

export function OpportunityScoreCard({
  score,
  breakdown,
  reasoning,
  loading = false,
  className,
}: OpportunityScoreCardProps) {
  const hasScore = score != null && Number.isFinite(score)
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null

  if (loading && !hasScore) {
    return (
      <section
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
          className
        )}
        aria-label="시장 기회 점수"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
          </div>
          <div className="h-16 w-24 rounded-lg bg-muted/40 animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 rounded bg-muted/30 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!hasScore) return null

  const breakdownItems = breakdown
    ? (['market_growth', 'competition_pressure', 'user_demand', 'product_differentiation', 'market_timing'] as const)
        .filter((k) => breakdown[k] != null)
        .map((k) => ({
          key: k,
          label: BREAKDOWN_LABELS[k] ?? k,
          value: Math.round(Math.min(100, Math.max(0, breakdown[k] ?? 0))),
        }))
    : []

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        className
      )}
      aria-label="Opportunity Score"
    >
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Target className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            시장 기회 점수
          </h2>
        </div>

        {/* Main Score */}
        <div className="flex items-baseline gap-2 mb-8">
          <span
            className={cn(
              'text-4xl sm:text-5xl lg:text-6xl font-bold tabular-nums',
              scoreColor(normScore ?? 0)
            )}
          >
            {normScore}
          </span>
          <span className="text-xl sm:text-2xl text-muted-foreground font-medium">
            / 100
          </span>
        </div>

        {/* Score Breakdown */}
        {breakdownItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              점수 구성
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {breakdownItems.map(({ key, label, value }) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
                >
                  <span className="text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums',
                      scoreColor(value)
                    )}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why This Score */}
        {reasoning && reasoning.trim().length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-primary" />
              점수 산출 근거
            </h3>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {reasoning.trim()}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
