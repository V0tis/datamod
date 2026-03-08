'use client'

import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Display labels: English primary (user spec) + Korean */
const LABELS: Record<string, string> = {
  trend_momentum: 'Search Demand',
  market_growth: 'Market Growth',
  competition_density: 'Competition Level',
  competition_pressure: 'Competition Level',
  funding_signals: 'Funding Signals',
  risk_factors: 'Risk Factors',
  user_demand: 'Search Demand',
  product_differentiation: 'Product Differentiation',
  market_timing: 'Market Timing',
}

const LABELS_KO: Record<string, string> = {
  trend_momentum: '검색 수요',
  market_growth: '시장 성장',
  competition_density: '경쟁 수준',
  competition_pressure: '경쟁 수준',
  funding_signals: '투자 신호',
  risk_factors: '리스크 요인',
  user_demand: '검색 수요',
  product_differentiation: '제품 차별화',
  market_timing: '시장 타이밍',
}

/** Order: Search Demand, Market Growth, Competition Level, Funding Signals, Risk Factors */
const ORDER: readonly string[] = [
  'trend_momentum',
  'market_growth',
  'competition_density',
  'competition_pressure',
  'funding_signals',
  'risk_factors',
]

export interface OpportunityScoreBreakdownProps {
  score: number | null
  breakdown?: {
    market_growth?: number
    trend_momentum?: number
    competition_density?: number
    competition_pressure?: number
    funding_signals?: number
    risk_factors?: number
    user_demand?: number
    product_differentiation?: number
    market_timing?: number
  } | null
  /** Show Korean labels instead of English */
  useKoreanLabels?: boolean
  /** Compact layout (e.g. inside cards) */
  compact?: boolean
  className?: string
}

/**
 * Opportunity Score Breakdown – explains how the score was calculated.
 * Uses stacked bar + segmented progress bars so users understand each component.
 */
export function OpportunityScoreBreakdown({
  score,
  breakdown,
  useKoreanLabels = false,
  compact = false,
  className,
}: OpportunityScoreBreakdownProps) {
  const hasScore = score != null && Number.isFinite(score)
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null

  const items = breakdown
    ? ORDER.filter((k) => breakdown[k as keyof typeof breakdown] != null).map((k) => {
        const raw = Number(breakdown[k as keyof typeof breakdown])
        const value =
          k === 'competition_density' || k === 'risk_factors'
            ? raw
            : k === 'competition_pressure'
              ? 50 - raw
              : raw
        return {
          key: k,
          label: (useKoreanLabels ? LABELS_KO : LABELS)[k] ?? k,
          value: Math.round(value),
        }
      })
    : []

  if (!hasScore && items.length === 0) return null

  const maxAbs = Math.max(30, ...items.map((i) => Math.abs(i.value)), 1)
  const base = 50
  const totalAbs = base + items.reduce((s, i) => s + Math.abs(i.value), 0)

  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-card/50 overflow-hidden',
        compact ? 'p-4' : 'p-5 sm:p-6',
        className
      )}
      aria-label="기회 점수 분해"
    >
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          {useKoreanLabels ? '기회 점수 분해' : 'Opportunity Score Breakdown'}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {useKoreanLabels
          ? '점수는 기본 50점에 다음 요인들이 더해져 계산됩니다.'
          : 'The score is calculated from a base of 50 plus the factors below.'}
      </p>

      {/* Stacked bar: Base + each factor as a segment */}
      {items.length > 0 && totalAbs > 0 && (
        <div className="mb-6">
          <div
            className="h-6 rounded-lg overflow-hidden flex flex-row"
            role="img"
            aria-label={
              useKoreanLabels
                ? `기본 50, ${items.map((i) => `${i.label} ${i.value >= 0 ? '+' : ''}${i.value}`).join(', ')}`
                : `Base 50, ${items.map((i) => `${i.label} ${i.value >= 0 ? '+' : ''}${i.value}`).join(', ')}`
            }
          >
            {/* Base segment */}
            <div
              className="bg-muted shrink-0 transition-all duration-500"
              style={{ width: `${(base / totalAbs) * 100}%` }}
              title={useKoreanLabels ? '기본 50' : 'Base 50'}
            />
            {items.map(({ key, label, value }) => {
              const pct = (Math.abs(value) / totalAbs) * 100
              const isPositive = value >= 0
              return (
                <div
                  key={key}
                  className={cn(
                    'shrink-0 transition-all duration-500',
                    isPositive ? 'bg-emerald-500/80 dark:bg-emerald-500/70' : 'bg-rose-500/80 dark:bg-rose-500/70'
                  )}
                  style={{ width: `${pct}%` }}
                  title={`${label} ${value >= 0 ? '+' : ''}${value}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
            <span>{useKoreanLabels ? '기본 50' : 'Base 50'}</span>
            <span className="tabular-nums font-medium text-foreground">
              = {normScore} / 100
            </span>
          </div>
        </div>
      )}

      {/* Per-factor segmented progress bars */}
      {items.length > 0 && (
        <div className="space-y-4">
          {items.map(({ key, label, value }) => {
            const isPositive = value >= 0
            const displayValue = value > 0 ? `+${value}` : String(value)
            const barPct = Math.min(100, (Math.abs(value) / maxAbs) * 100)

            return (
              <div
                key={key}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                <div className="flex items-center justify-between sm:justify-start sm:w-40 shrink-0">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <span
                    className={cn(
                      'text-sm font-bold tabular-nums shrink-0',
                      isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                    )}
                  >
                    {displayValue}
                  </span>
                </div>
                <div
                  className="flex-1 h-3 sm:h-4 rounded-full overflow-hidden bg-muted/40"
                  role="presentation"
                >
                  <div className="flex h-full w-full relative">
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/80 shrink-0" aria-hidden />
                    {isPositive ? (
                      <div
                        className="absolute left-1/2 top-0 bottom-0 rounded-r-full transition-all duration-500 bg-emerald-500/80 dark:bg-emerald-500/70"
                        style={{ width: `${barPct / 2}%` }}
                      />
                    ) : (
                      <div
                        className="absolute right-1/2 top-0 bottom-0 rounded-l-full transition-all duration-500 bg-rose-500/80 dark:bg-rose-500/70"
                        style={{ width: `${barPct / 2}%` }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
