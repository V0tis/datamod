'use client'

import { Target, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Maps breakdown keys to display labels (user-facing). New signed format. */
const BREAKDOWN_LABELS: Record<string, string> = {
  market_growth: 'Market Growth',
  competition_density: 'Competition Density',
  trend_momentum: 'Trend Momentum',
  funding_signals: 'Funding Signals',
  risk_factors: 'Risk Factors',
  // Legacy
  competition_pressure: 'Competition Density',
  user_demand: 'Funding Signals',
  product_differentiation: 'Product Differentiation',
  market_timing: 'Trend Momentum',
}

type NewBreakdownKey = 'market_growth' | 'competition_density' | 'trend_momentum' | 'funding_signals' | 'risk_factors'
type LegacyBreakdownKey = 'market_growth' | 'competition_pressure' | 'user_demand' | 'product_differentiation' | 'market_timing'
type BreakdownKey = NewBreakdownKey | LegacyBreakdownKey

/** Order for Score Breakdown section (new format first) */
const SCORE_BREAKDOWN_ORDER: readonly NewBreakdownKey[] = [
  'market_growth',
  'competition_density',
  'trend_momentum',
  'funding_signals',
  'risk_factors',
]

/** Legacy order for fallback */
const LEGACY_ORDER: readonly LegacyBreakdownKey[] = [
  'market_growth',
  'competition_pressure',
  'user_demand',
  'product_differentiation',
  'market_timing',
]

export interface OpportunityScoreCardProps {
  score: number | null
  breakdown?: {
    market_growth?: number
    competition_density?: number
    trend_momentum?: number
    funding_signals?: number
    risk_factors?: number
    competition_pressure?: number
    user_demand?: number
    product_differentiation?: number
    market_timing?: number
  } | null
  reasoning?: string | null
  loading?: boolean
  /** Activity message shown during loading (e.g. "Analyzing Market Signals...") */
  loadingMessage?: string | null
  className?: string
}

/** Check if breakdown uses new signed format (any of the new keys present) */
function isNewFormat(b: NonNullable<OpportunityScoreCardProps['breakdown']>): boolean {
  return (
    b.competition_density != null ||
    b.trend_momentum != null ||
    b.funding_signals != null ||
    b.risk_factors != null
  )
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
  loadingMessage,
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
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
          </div>
          {(loadingMessage ?? '점수 계산 중...') && (
            <p className="text-sm font-medium text-muted-foreground mb-3 animate-pulse">
              {loadingMessage ?? '점수 계산 중...'}
            </p>
          )}
          <div className="h-14 w-20 rounded-lg bg-muted/40 animate-pulse mb-4" aria-hidden />
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

  const useNewFormat = breakdown && isNewFormat(breakdown)
  const order = useNewFormat ? SCORE_BREAKDOWN_ORDER : LEGACY_ORDER
  const breakdownItems = breakdown
    ? order
        .filter((k) => breakdown[k] != null)
        .map((k) => {
          const raw = Number(breakdown[k])
          const isSigned = useNewFormat || k === 'competition_density' || k === 'risk_factors'
          const value = isSigned
            ? raw
            : k === 'competition_pressure'
              ? 50 - raw
              : raw - 50
          return {
            key: k,
            label: BREAKDOWN_LABELS[k] ?? k,
            value: Math.round(value),
          }
        })
    : []

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        className
      )}
      aria-label="Opportunity Score"
    >
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Opportunity Score
          </h2>
        </div>

        {/* Main Score + Progress Bar */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-3">
            <span
              className={cn(
                'text-3xl sm:text-4xl font-bold tabular-nums',
                scoreColor(normScore ?? 0)
              )}
            >
              {normScore}
            </span>
            <span className="text-xl sm:text-2xl text-muted-foreground font-medium">
              / 100
            </span>
          </div>
          <div
            className="h-2.5 rounded-full bg-muted/70 dark:bg-muted/50 border border-border/60 overflow-hidden"
            role="progressbar"
            aria-valuenow={normScore ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="기회 점수 게이지"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 min-w-[6%]',
                (normScore ?? 0) >= 70 ? 'bg-emerald-500' : (normScore ?? 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500'
              )}
              style={{
                width: `${Math.max(
                  normScore ?? 0,
                  (normScore ?? 0) > 0 ? 6 : 0
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Score Breakdown */}
        {breakdownItems.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Score Breakdown
            </h3>
            <div className="space-y-2">
              {breakdownItems.map(({ key, label, value }) => {
                const isPositive = value >= 0
                const displayValue = value > 0 ? `+${value}` : String(value)
                return (
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
                        isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                      )}
                    >
                      {displayValue}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* AI Explanation */}
        {reasoning && reasoning.trim().length > 0 && (
          <div className="rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Explanation
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
