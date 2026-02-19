'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SentimentFactorBreakdown, type SentimentFactors } from '@/components/research/sentiment-factor-breakdown'

/** Map -100~100 to 0–100 for PM-friendly display. */
function toZeroHundred(score: number): number {
  return Math.round(Math.max(0, Math.min(100, (score + 100) / 2)))
}

/** Textual interpretation: subtle, no strong colors. */
function getInterpretation(normalized: number): string {
  if (normalized < 25) return '냉랭'
  if (normalized < 50) return '선선함'
  if (normalized < 75) return '따뜻함'
  return '뜨거움'
}

/** Trend label for PM report. */
function getTrendLabel(trend?: 'rising' | 'falling' | 'stable'): string {
  if (trend === 'rising') return '상승'
  if (trend === 'falling') return '하락'
  return '보합'
}

/** One-line reasoning for score. */
function getReasoningSummary(
  normalized: number,
  factors: SentimentFactors | null | undefined
): string {
  const interp = getInterpretation(normalized)
  if (factors && typeof factors.positive === 'number' && typeof factors.negative === 'number') {
    const p = Math.round(Number(factors.positive) || 0)
    const n = Math.round(Number(factors.negative) || 0)
    if (p > n) return `긍정 신호가 부정보다 강해 ${interp} 구간입니다.`
    if (n > p) return `부정·리스크가 반영되어 ${interp} 구간입니다.`
  }
  return `뉴스·시장 신호를 종합해 ${interp} 구간으로 산출했습니다.`
}

interface MarketTemperatureProps {
  score: number | null
  trend?: 'rising' | 'falling' | 'stable'
  factors?: SentimentFactors | null
  /** Positive/neutral/negative signal texts (PM schema). Shown persistently when provided. */
  positiveSignals?: string[]
  neutralSignals?: string[]
  negativeRisks?: string[]
  loading?: boolean
  className?: string
}

/**
 * Market Temperature: score, trend, explanation always visible.
 * Charts/factor bars are secondary and collapsed by default.
 */
export function MarketTemperature({
  score,
  trend = 'stable',
  factors,
  positiveSignals = [],
  neutralSignals = [],
  negativeRisks = [],
  loading = false,
  className,
}: MarketTemperatureProps) {
  const hasScore = score != null && Number.isFinite(score)
  const norm = hasScore ? toZeroHundred(score) : null
  const hasSignals = positiveSignals.length > 0 || neutralSignals.length > 0 || negativeRisks.length > 0

  return (
    <div className={cn('space-y-3', className)}>
      {/* Score + trend: primary, always visible */}
      <div className="flex flex-wrap items-baseline gap-2">
        {hasScore ? (
          <>
            <span className="text-lg font-semibold tabular-nums text-foreground">{norm}</span>
            <span className="text-muted-foreground">/ 100</span>
            <span className="text-sm text-muted-foreground">· {getInterpretation(norm!)}</span>
            <span className="text-xs text-muted-foreground">· {getTrendLabel(trend)}</span>
          </>
        ) : (
          <>
            <span className="h-6 w-12 rounded bg-muted/60" aria-hidden />
            <span className="text-muted-foreground">/ 100</span>
            {loading && <span className="text-sm text-muted-foreground">분석 중</span>}
          </>
        )}
      </div>

      {/* Explanation: persistently visible (no details). Positive / neutral / negative. */}
      <div className="space-y-2 text-sm">
        {loading && !hasScore ? (
          <div className="space-y-2 text-muted-foreground">
            <p className="h-4 w-full rounded bg-muted/40" />
            <p className="h-4 w-4/5 rounded bg-muted/40" />
          </div>
        ) : hasSignals ? (
          <>
            {positiveSignals.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">긍정 신호</span>
                <ul className="mt-1 space-y-0.5 list-none pl-0 text-foreground">
                  {positiveSignals.slice(0, 3).map((s, i) => (
                    <li key={i} className="leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {neutralSignals.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">중립</span>
                <ul className="mt-1 space-y-0.5 list-none pl-0 text-foreground">
                  {neutralSignals.slice(0, 2).map((s, i) => (
                    <li key={i} className="leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {negativeRisks.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">부정·리스크</span>
                <ul className="mt-1 space-y-0.5 list-none pl-0 text-foreground">
                  {negativeRisks.slice(0, 3).map((s, i) => (
                    <li key={i} className="leading-relaxed">{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : hasScore ? (
          <p className="text-muted-foreground leading-relaxed">{getReasoningSummary(norm!, factors)}</p>
        ) : (
          <p className="text-muted-foreground text-sm">분석 완료 후 표시됩니다.</p>
        )}
      </div>

      {/* Charts: secondary, collapsed by default. UX: explanation first; bars optional. */}
      {factors && hasScore && (
        <details className="group border-t border-border/50 pt-2">
          <summary className="text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground list-none [&::-webkit-details-marker]:hidden flex items-center gap-1">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            참고: 감성 비율
          </summary>
          <div className="mt-2">
            <SentimentFactorBreakdown factors={factors} />
          </div>
        </details>
      )}
    </div>
  )
}
