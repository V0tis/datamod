'use client'

import { cn } from '@/lib/utils'

export type MarketOutlook = 'high' | 'medium' | 'low'

function opportunityToOutlook(score: number): MarketOutlook {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function outlookLabel(outlook: MarketOutlook): string {
  switch (outlook) {
    case 'high': return '높음'
    case 'medium': return '중간'
    case 'low': return '낮음'
  }
}

function outlookColor(outlook: MarketOutlook): string {
  switch (outlook) {
    case 'high': return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
    case 'medium': return 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
    case 'low': return 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
  }
}

function scoreGaugeColor(score: number): string {
  if (score >= 70) return 'stroke-emerald-500'
  if (score >= 50) return 'stroke-amber-500'
  return 'stroke-rose-500'
}

export interface ResultPageHeroProps {
  /** Market idea / keyword (main title) */
  title: string
  /** Optional Korean translation or subtitle */
  titleSub?: string | null
  /** Opportunity score 0–100 */
  opportunityScore: number | null
  /** AI confidence 0–100 */
  confidenceScore: number | null
  /** Top insight summary (1–2 sentences) */
  topInsight: string | null
  /** Status text or element (e.g. last updated, loading message) */
  statusText?: React.ReactNode
  loading?: boolean
  /** Optional actions (share, AI model toggle) – render as children or slot */
  actions?: React.ReactNode
  className?: string
}

/**
 * Result Page Hero – conveys the final AI conclusion in ~3 seconds.
 * Structure: Market Idea Title | Opportunity Gauge | Market Outlook | AI Confidence | Top Insight
 */
export function ResultPageHero({
  title,
  titleSub,
  opportunityScore,
  confidenceScore,
  topInsight,
  statusText,
  loading = false,
  actions,
  className,
}: ResultPageHeroProps) {
  const hasScore = opportunityScore != null && Number.isFinite(opportunityScore)
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, opportunityScore))) : null
  const outlook = normScore != null ? opportunityToOutlook(normScore) : null
  const confDisplay =
    confidenceScore != null && Number.isFinite(confidenceScore)
      ? Math.round(Math.min(100, Math.max(0, confidenceScore)))
      : null

  return (
    <header
      className={cn(
        'rounded-xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8',
        className
      )}
      aria-label="분석 결과 요약"
    >
      {/* Row 1: Title + Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight break-words">
            {loading && !title ? (
              <span className="inline-block h-9 sm:h-10 w-48 rounded bg-muted animate-pulse" />
            ) : (
              title
            )}
          </h1>
          {titleSub && (
            <p className="mt-1 text-base sm:text-lg text-muted-foreground" aria-hidden>
              {titleSub}
            </p>
          )}
          {statusText && (
            <p className="mt-2 text-sm text-muted-foreground">{statusText}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Row 2: Gauge + Badges + Insight */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Opportunity Score – large visual gauge */}
        <div className="flex flex-col sm:flex-row items-start gap-6 shrink-0">
          <div className="flex flex-col items-center" aria-label="기회 점수">
            {loading && !hasScore ? (
              <div className="h-24 w-36 rounded-t-full bg-muted/50 animate-pulse" />
            ) : (
              <svg
                viewBox="0 0 120 70"
                className="h-24 w-36 sm:h-28 sm:w-40"
                aria-hidden
              >
                {/* Background arc */}
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="text-muted/30"
                />
                {/* Value arc – dasharray: draw length, gap; offset hides unfilled portion */}
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray="157 157"
                  strokeDashoffset={157 - ((normScore ?? 0) / 100) * 157}
                  className={cn(
                    'transition-all duration-700 ease-out',
                    normScore != null ? scoreGaugeColor(normScore) : 'text-muted'
                  )}
                />
              </svg>
            )}
            <div
              className={cn(
                'flex items-baseline gap-1 mt-2',
                loading && !hasScore && 'opacity-0'
              )}
            >
              <span
                className={cn(
                  'text-3xl sm:text-4xl font-bold tabular-nums',
                  normScore != null && normScore >= 70 && 'text-emerald-600 dark:text-emerald-400',
                  normScore != null && normScore >= 50 && normScore < 70 && 'text-amber-600 dark:text-amber-400',
                  normScore != null && normScore < 50 && 'text-rose-600 dark:text-rose-400'
                )}
              >
                {normScore ?? '—'}
              </span>
              <span className="text-lg text-muted-foreground font-medium">/100</span>
            </div>
            <span className="text-xs font-medium text-muted-foreground mt-0.5">기회 점수</span>
          </div>

          {/* Badges: Market Outlook + AI Confidence */}
          <div className="flex flex-wrap gap-2 sm:flex-col sm:gap-3">
            {outlook != null && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  시장 전망
                </span>
                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1.5 rounded-lg border text-sm font-bold',
                    outlookColor(outlook)
                  )}
                >
                  {outlookLabel(outlook)}
                </span>
              </div>
            )}
            {confDisplay != null && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI 신뢰도
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-sm font-bold text-foreground">
                  {confDisplay}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Top Insight Summary */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            핵심 인사이트
          </p>
          {loading && !topInsight ? (
            <div className="space-y-2">
              <div className="h-5 w-full max-w-lg rounded bg-muted/50 animate-pulse" />
              <div className="h-5 w-4/5 max-w-md rounded bg-muted/40 animate-pulse" />
            </div>
          ) : (
            <p className="text-lg sm:text-xl font-semibold text-foreground leading-relaxed">
              {topInsight || 'AI 분석 결과를 기다리는 중입니다.'}
            </p>
          )}
        </div>
      </div>
    </header>
  )
}
