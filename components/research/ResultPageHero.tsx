'use client'

import { useState, memo } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
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

type BreakdownData = {
  search_demand?: number
  market_growth?: number
  competition_density?: number
  investment_signals?: number
  risk_factor?: number
  trend_momentum?: number
  competition_pressure?: number
}

const BREAKDOWN_FACTORS: { key: keyof BreakdownData; label: string }[] = [
  { key: 'search_demand', label: '검색 수요' },
  { key: 'market_growth', label: '시장 성장' },
  { key: 'trend_momentum', label: '트렌드 모멘텀' },
  { key: 'competition_density', label: '경쟁 수준' },
  { key: 'competition_pressure', label: '경쟁 압력' },
  { key: 'investment_signals', label: '투자 신호' },
  { key: 'risk_factor', label: '리스크 요인' },
]

function ScoreExplanationPanel({ breakdown }: { breakdown: BreakdownData }) {
  const factors = BREAKDOWN_FACTORS.filter(({ key }) => typeof breakdown[key] === 'number')
  if (factors.length === 0) return null

  return (
    <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        점수 산출 근거
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {factors.map(({ key, label }) => {
          const val = breakdown[key]!
          const isPositive = val > 0
          return (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn('font-semibold tabular-nums', isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {isPositive ? '+' : ''}{val}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        기본 점수 50에서 각 요인이 가감되어 최종 기회 점수가 산출됩니다. 자세한 분해는 아래 &ldquo;시장 개요&rdquo; 섹션을 참고하세요.
      </p>
    </div>
  )
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
  /** Opportunity score breakdown factors */
  scoreBreakdown?: {
    search_demand?: number
    market_growth?: number
    competition_density?: number
    investment_signals?: number
    risk_factor?: number
    trend_momentum?: number
    competition_pressure?: number
  } | null
  /** Status text or element (e.g. last updated, loading message) */
  statusText?: React.ReactNode
  loading?: boolean
  /** Optional actions (share, AI model toggle) – render as children or slot */
  actions?: React.ReactNode
  /** Analysis state for success/fail badge near score */
  analysisStatus?: 'idle' | 'loading' | 'success' | 'fail'
  /** AI 분석 타임라인 – 마지막 업데이트 하단, 핵심 인사이트 위에 배치 */
  timelineSlot?: React.ReactNode
  /** 분석 진행 중 헤더 내 진행률 표시 (progress bar + step) */
  progressSlot?: React.ReactNode
  className?: string
}

/**
 * Result Page Hero – conveys the final AI conclusion in ~3 seconds.
 * Structure: Market Idea Title | Opportunity Gauge | Market Outlook | AI Confidence | Top Insight
 */
export const ResultPageHero = memo(function ResultPageHero({
  title,
  titleSub,
  opportunityScore,
  confidenceScore,
  topInsight,
  scoreBreakdown,
  statusText,
  loading = false,
  actions,
  analysisStatus,
  timelineSlot,
  progressSlot,
  className,
}: ResultPageHeroProps) {
  const [scoreExplainOpen, setScoreExplainOpen] = useState(false)
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
          {loading && progressSlot && (
            <div className="mt-3 max-w-md">{progressSlot}</div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* AI 분석 타임라인 – 마지막 업데이트 하단, 핵심 인사이트 위 */}
      {timelineSlot && <div className="mb-6">{timelineSlot}</div>}

      {/* Row 2: Gauge + Badges + Insight */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* Opportunity Score – large visual gauge */}
        <div className="flex flex-col sm:flex-row items-start gap-6 shrink-0">
          <div className="flex flex-col items-center" aria-label="기회 점수">
            {loading && !hasScore ? (
              <div className="h-24 w-36 rounded-t-full bg-muted/50 animate-pulse" aria-hidden />
            ) : (
              <svg
                viewBox="0 0 120 70"
                className="h-24 w-36 sm:h-28 sm:w-40"
                aria-hidden
              >
                {/* Background track – visible track for context */}
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="12"
                  strokeLinecap="round"
                  className="text-muted/50 dark:text-muted/40"
                />
                {/* Value arc – min 6% visible when score > 0 */}
                {normScore != null ? (
                  <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="157 157"
                    strokeDashoffset={
                      157 -
                      Math.max(
                        (normScore / 100) * 157,
                        normScore > 0 ? 0.06 * 157 : 0
                      )
                    }
                    className={cn(
                      'transition-all duration-700 ease-out',
                      scoreGaugeColor(normScore)
                    )}
                  />
                ) : null}
              </svg>
            )}
            <div className="flex items-baseline gap-1 mt-2">
              {loading && !hasScore ? (
                <span className="text-base font-medium text-muted-foreground">점수 계산 중...</span>
              ) : (
                <>
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
                </>
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground mt-0.5">기회 점수</span>
            {normScore != null && scoreBreakdown && (
              <button
                type="button"
                onClick={() => setScoreExplainOpen((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
              >
                왜 이런 점수가 나왔나요?
                {scoreExplainOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Badges: Status (success/fail) + Market Outlook + AI Confidence */}
          <div className="flex flex-wrap gap-2 sm:flex-col sm:gap-3">
            {analysisStatus === 'success' && !loading && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  분석
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
                  완료
                </span>
              </div>
            )}
            {analysisStatus === 'fail' && !loading && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  분석
                </span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-400 text-sm font-bold">
                  실패
                </span>
              </div>
            )}
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
            주요 결론
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

      {/* Score Explanation Panel */}
      {scoreExplainOpen && normScore != null && scoreBreakdown && (
        <ScoreExplanationPanel breakdown={scoreBreakdown} />
      )}
    </header>
  )
})
