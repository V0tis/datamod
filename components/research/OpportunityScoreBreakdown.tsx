'use client'

import { Target, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'

const LABELS: Record<string, string> = {
  trend_momentum: '검색 수요',
  market_growth: '시장 성장',
  competition_density: '경쟁 밀도',
  competition_pressure: '경쟁 압력',
  funding_signals: '투자 신호',
  risk_factors: '리스크 요인',
  user_demand: '검색 수요',
  product_differentiation: '제품 차별화',
  market_timing: '시장 타이밍',
}

/** @deprecated Use LABELS directly – now always Korean */
const LABELS_KO = LABELS

/** Order: Search Demand → Market Growth → Competition → Funding → Risk */
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
  /** While analysis is running, show "산출 중..." instead of numeric score */
  loading?: boolean
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

const BASE = 50

/**
 * Opportunity Score Breakdown – Waterfall visualization.
 * Shows how the final score is derived: Base 50 → each factor → Final Score.
 */
export function OpportunityScoreBreakdown({
  score,
  loading = false,
  breakdown,
  useKoreanLabels = false,
  compact = false,
  className,
}: OpportunityScoreBreakdownProps) {
  const effectiveBreakdown = breakdown && Object.keys(breakdown).length > 0 ? breakdown : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const hasScore = !loading && score != null && Number.isFinite(score)
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null

  const items = effectiveBreakdown
    ? ORDER.filter((k) => effectiveBreakdown[k as keyof typeof effectiveBreakdown] != null).map((k) => {
        const raw = Number(effectiveBreakdown[k as keyof typeof effectiveBreakdown])
        const value =
          k === 'competition_density' || k === 'risk_factors'
            ? raw
            : k === 'competition_pressure'
              ? (raw === 0 || Number.isNaN(raw) ? 0 : BASE - raw)
              : raw
        return {
          key: k,
          label: LABELS[k] ?? k,
          value: Math.round(value),
        }
      })
    : []

  /** Max absolute delta for bar scaling (excluding base) */
  const maxAbs = Math.max(15, ...items.map((i) => Math.abs(i.value)), 1)
  const scaleMax = maxAbs * 1.2

  /** Explanation lines for low score: use breakdown to describe why score is low */
  const explanationLines: string[] = []
  if (!loading && effectiveBreakdown) {
    const compD = Number(effectiveBreakdown.competition_density)
    const compP = Number(effectiveBreakdown.competition_pressure)
    if (compD > 0 || (typeof effectiveBreakdown.competition_pressure === 'number' && effectiveBreakdown.competition_pressure > 40))
      explanationLines.push('경쟁 수준이 높아 점수가 낮습니다.')
    const growth = Number(effectiveBreakdown.market_growth)
    const trend = Number(effectiveBreakdown.trend_momentum)
    if (growth < 0 || trend < 0) explanationLines.push('시장 성장률이 낮습니다.')
    const risk = Number(effectiveBreakdown.risk_factors)
    if (risk > 0) explanationLines.push('리스크 요인이 점수를 낮춥니다.')
    const funding = Number(effectiveBreakdown.funding_signals)
    if (funding < 0) explanationLines.push('투자·펀딩 신호가 부족합니다.')
  }
  const hasExplanation = explanationLines.length > 0

  const baseLabel = '기본 점수'
  const finalLabel = '최종 점수'

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
          기회 점수 분해
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        기본 50점에서 각 요인을 순차적으로 반영해 최종 점수가 산출됩니다.
      </p>

      {/* Waterfall: Base → Factors → Final */}
      <div className="space-y-3">
        {/* 1. Base score */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-sm font-medium text-foreground w-28 sm:w-32 shrink-0">{baseLabel}</span>
          <div className="flex-1 h-8 rounded-lg overflow-hidden bg-muted/60 flex items-center justify-center min-w-0">
            <span className="text-sm font-bold tabular-nums text-foreground">{BASE}</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-muted-foreground w-10 text-right shrink-0">{BASE}</span>
        </div>

        {/* 2. Each factor: waterfall delta bar (green = positive, red = negative) */}
        {items.map(({ key, label, value }) => {
          const isPositive = value >= 0
          const displayValue = value > 0 ? `+${value}` : String(value)
          const barWidthPct = Math.min(50, (Math.abs(value) / scaleMax) * 50)

          return (
            <div key={key} className="flex items-center gap-3 sm:gap-4">
              <span className="text-sm font-medium text-foreground w-28 sm:w-32 shrink-0">{label}</span>
              <div className="flex-1 h-8 rounded-lg overflow-hidden bg-muted/30 flex items-center relative min-w-0">
                {/* Center line (zero) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-0" aria-hidden />
                {/* Delta bar: positive → right from center, negative → left from center */}
                <div
                  className={cn(
                    'absolute top-0 bottom-0 h-full rounded transition-all duration-500 flex items-center justify-center z-10',
                    isPositive ? 'bg-emerald-500/90 dark:bg-emerald-600/80' : 'bg-rose-500/90 dark:bg-rose-600/80'
                  )}
                  style={{
                    width: `${barWidthPct}%`,
                    ...(isPositive ? { left: '50%' } : { right: '50%', left: 'auto' }),
                  }}
                >
                  <span className="text-xs font-bold tabular-nums text-white drop-shadow-sm whitespace-nowrap">
                    {displayValue}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  'text-sm font-bold tabular-nums w-10 text-right shrink-0',
                  isPositive ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                )}
              >
                {displayValue}
              </span>
            </div>
          )
        })}

        {/* 3. Final score */}
        <div className="pt-2 mt-4 border-t border-border/80">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="text-sm font-semibold text-foreground w-28 sm:w-32 shrink-0">{finalLabel}</span>
            <div className="flex-1 h-10 rounded-lg bg-primary/15 dark:bg-primary/20 border-2 border-primary/40 flex items-center justify-center min-w-0">
              {loading ? (
                <span className="text-sm font-medium text-muted-foreground">
                  산출 중...
                </span>
              ) : (
                <span className="text-xl font-bold tabular-nums text-primary">
                  {normScore != null ? `${normScore} / 100` : '—'}
                </span>
              )}
            </div>
            {normScore != null && !loading && (
              <span className="text-lg font-bold tabular-nums text-primary w-14 text-right shrink-0">{normScore}</span>
            )}
          </div>
        </div>
      </div>

      {hasExplanation && (
        <Card className="mt-4 border-border/60 bg-muted/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">점수가 낮은 이유</p>
                <ul className="text-sm text-foreground list-disc list-inside space-y-0.5">
                  {explanationLines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}
