'use client'

import { cn } from '@/lib/utils'
import { SentimentFactorBreakdown, type SentimentFactors } from '@/components/research/sentiment-factor-breakdown'

/** Map -100~100 to 0–100 for PM-friendly display. No algorithm change. */
function toZeroHundred(score: number): number {
  return Math.round(Math.max(0, Math.min(100, (score + 100) / 2)))
}

/** Textual interpretation: subtle, scannable. No strong colors. */
function getInterpretation(normalized: number): string {
  if (normalized < 25) return '냉랭'
  if (normalized < 50) return '선선함'
  if (normalized < 75) return '따뜻함'
  return '뜨거움'
}

/** One-line reasoning: readable in <5s. */
function getReasoningSummary(
  normalized: number,
  factors: SentimentFactors | null | undefined
): string {
  const interp = getInterpretation(normalized)
  if (factors && typeof factors.positive === 'number' && typeof factors.negative === 'number') {
    const p = Math.round(Number(factors.positive) || 0)
    const n = Math.round(Number(factors.negative) || 0)
    if (p > n) return `긍정 신호가 부정보다 강해 ${interp} 구간입니다. 수요·성장 지표가 상대적으로 양호합니다.`
    if (n > p) return `부정·리스크가 반영되어 ${interp} 구간입니다. 경쟁·변동성 등을 고려했습니다.`
  }
  return `뉴스·시장 신호와 AI 통찰을 종합해 ${interp} 구간으로 산출했습니다. 참고용 지표입니다.`
}

/** Skeleton for "Why this score?" during analysis. Keeps layout stable. */
function WhySkeleton() {
  return (
    <div className="space-y-2 pt-2 border-t border-border/40">
      <p className="text-[11px] font-medium text-muted-foreground">왜 이 점수가 나왔는가?</p>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">긍정 신호</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
          <span className="w-8 shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">중립</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
          <span className="w-8 shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">부정·리스크</span>
          <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
          <span className="w-8 shrink-0" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-muted/60 animate-pulse mt-2" />
    </div>
  )
}

interface MarketTemperatureProps {
  /** Raw score -100~100 from consensus or key_metrics */
  score: number | null
  factors?: SentimentFactors | null
  /** Show skeleton "Why" section during analysis. UX: always visible, no layout shift. */
  loading?: boolean
  className?: string
}

/**
 * PM explainable component: score + "Why this score?" (positive/neutral/negative).
 * Always show Why section—skeleton during analysis to avoid layout shift.
 */
export function MarketTemperature({
  score,
  factors,
  loading = false,
  className,
}: MarketTemperatureProps) {
  const hasScore = score != null && Number.isFinite(score)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline gap-2">
        {hasScore ? (
          <>
            <span className="text-lg font-semibold tabular-nums text-foreground">{toZeroHundred(score)}</span>
            <span className="text-muted-foreground">/ 100</span>
            <span className="text-sm text-muted-foreground">· {getInterpretation(toZeroHundred(score))}</span>
          </>
        ) : (
          <>
            <span className="h-6 w-12 rounded bg-muted animate-pulse" />
            <span className="text-muted-foreground">/ 100</span>
            {loading && <span className="text-sm text-muted-foreground">분석 중</span>}
          </>
        )}
      </div>
      {/* UX: Always show "Why" section. During analysis: skeleton. After: real factors + reasoning. */}
      <div className="mt-1">
        {loading && !hasScore ? (
          <WhySkeleton />
        ) : hasScore ? (
          <details className="group" open>
            <summary className="text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
              왜 이 점수가 나왔는가?
            </summary>
            <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
              {factors && <SentimentFactorBreakdown factors={factors} />}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {getReasoningSummary(toZeroHundred(score), factors)}
              </p>
            </div>
          </details>
        ) : (
          <p className="text-[11px] text-muted-foreground">분석 완료 후 표시됩니다.</p>
        )}
      </div>
    </div>
  )
}
