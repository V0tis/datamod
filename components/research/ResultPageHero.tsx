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
  /** When false, hide score gauge, badges, and top insight (only title + timeline + actions). Use when analysis has no result yet. */
  showScoreAndConclusion?: boolean
  /** Analysis meta badges: depth, cost, time, token, model, serper (shown when result is available) */
  analysisMeta?: {
    depth?: string
    cost?: string
    time?: string
    token?: string
    model?: string
    /** true = Serper 웹 검색으로 분석됨 */
    serperUsed?: boolean
  } | null
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
  showScoreAndConclusion = true,
  analysisMeta,
  className,
}: ResultPageHeroProps) {
  const [scoreExplainOpen, setScoreExplainOpen] = useState(false)
  const hasScore = showScoreAndConclusion && opportunityScore != null && Number.isFinite(opportunityScore)
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
          {analysisMeta && (analysisMeta.depth ?? analysisMeta.time ?? analysisMeta.token ?? analysisMeta.serperUsed) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {analysisMeta.depth && (
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  깊이: {analysisMeta.depth}
                </span>
              )}
              {analysisMeta.time && (
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  예상 시간: {analysisMeta.time}
                </span>
              )}
              {analysisMeta.token && (
                <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  토큰: {analysisMeta.token}
                </span>
              )}
              {analysisMeta.serperUsed && (
                <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Serper 웹 검색 분석
                </span>
              )}
            </div>
          )}
          {loading && progressSlot && (
            <div className="mt-3 max-w-md">{progressSlot}</div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* AI 분석 타임라인 – 마지막 업데이트 하단, 핵심 인사이트 위 */}
      {timelineSlot && <div className="mb-6">{timelineSlot}</div>}

      {/* Duplicate summary (기회 점수 / 시장 전망 / 주요 결론) removed – see Result Summary tab */}

      {/* Score Explanation Panel */}
      {scoreExplainOpen && normScore != null && scoreBreakdown && (
        <ScoreExplanationPanel breakdown={scoreBreakdown} />
      )}
    </header>
  )
})
