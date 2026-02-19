'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Map 0–100 to interpretation. */
function getInterpretation(score: number): string {
  if (score < 25) return '냉랭'
  if (score < 50) return '선선함'
  if (score < 75) return '따뜻함'
  return '뜨거움'
}

export interface ReportMarketTemperatureProps {
  score: number | null
  trend?: 'rising' | 'stable' | 'declining'
  positiveSignals?: string[]
  neutralSignals?: string[]
  negativeRisks?: string[]
  loading?: boolean
  /** Optional sparkline: secondary, minimal */
  showSparkline?: boolean
  className?: string
}

/** PM report block: large score, trend arrow, explanation always visible. */
export function ReportMarketTemperature({
  score,
  trend = 'stable',
  positiveSignals = [],
  neutralSignals = [],
  negativeRisks = [],
  loading = false,
  showSparkline = false,
  className,
}: ReportMarketTemperatureProps) {
  const hasScore = score != null && Number.isFinite(score)
  const norm = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null
  const hasSignals = positiveSignals.length > 0 || neutralSignals.length > 0 || negativeRisks.length > 0
  const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus
  const trendLabels = { rising: '상승', stable: '보합', declining: '하락' }

  return (
    <section className={cn('rounded-lg border border-border/60 bg-background/50 p-4 sm:p-5', className)} aria-label="Market temperature">
      <div className="flex flex-wrap items-baseline gap-3">
        {hasScore ? (
          <>
            <span className="text-2xl sm:text-3xl font-semibold tabular-nums text-foreground">{norm}</span>
            <span className="text-muted-foreground">/ 100</span>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <TrendIcon className="w-4 h-4" aria-hidden />
              {trendLabels[trend]}
            </span>
            <span className="text-sm text-muted-foreground">· {getInterpretation(norm!)}</span>
          </>
        ) : (
          <>
            <span className="h-9 w-16 rounded bg-muted/60" aria-hidden />
            {loading && <span className="text-sm text-muted-foreground">분석 중</span>}
          </>
        )}
      </div>

      <div className="mt-4 space-y-3 text-sm">
        {loading && !hasScore ? (
          <div className="space-y-2">
            <div className="h-4 w-full rounded bg-muted/40" />
            <div className="h-4 w-4/5 rounded bg-muted/40" />
          </div>
        ) : hasSignals ? (
          <>
            {positiveSignals.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">긍정 신호</span>
                <ul className="mt-1 space-y-0.5 list-none pl-0 text-foreground">
                  {positiveSignals.slice(0, 4).map((s, i) => (
                    <li key={i} className="leading-relaxed">· {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {neutralSignals.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">중립</span>
                <ul className="mt-1 space-y-0.5 list-none pl-0 text-foreground">
                  {neutralSignals.slice(0, 3).map((s, i) => (
                    <li key={i} className="leading-relaxed">· {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {negativeRisks.length > 0 && (
              <div>
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">리스크</span>
                <ul className="mt-1 space-y-0.5 list-none pl-0 text-foreground">
                  {negativeRisks.slice(0, 4).map((s, i) => (
                    <li key={i} className="leading-relaxed">· {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : hasScore ? (
          <p className="text-muted-foreground">시장 신호를 종합해 {getInterpretation(norm!)} 구간으로 산출했습니다.</p>
        ) : null}
      </div>

      {showSparkline && hasScore && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="h-8 w-full rounded bg-muted/30 flex items-end gap-0.5 px-1" aria-hidden>
            <div className="flex-1 bg-primary/40 rounded-t" style={{ height: `${norm}%` }} />
          </div>
        </div>
      )}
    </section>
  )
}
