'use client'

import { Target, Info, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { chartFontFamily, formatChartInt } from '@/lib/chartTheme'

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
  loading?: boolean
  stableScore?: number | null
  analysisFailed?: boolean
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
  useKoreanLabels?: boolean
  compact?: boolean
  className?: string
}

const BASE = 50

export function OpportunityScoreBreakdown({
  score,
  loading = false,
  stableScore = null,
  analysisFailed = false,
  breakdown,
  useKoreanLabels: _useKoreanLabels = false,
  compact = false,
  className,
}: OpportunityScoreBreakdownProps) {
  void _useKoreanLabels
  const effectiveBreakdown = breakdown && Object.keys(breakdown).length > 0 ? breakdown : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const resolvedRaw =
    score != null && Number.isFinite(score)
      ? score
      : analysisFailed && stableScore != null && Number.isFinite(stableScore)
        ? stableScore
        : null
  const hasScore = !loading && resolvedRaw != null
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, resolvedRaw))) : null

  const items = effectiveBreakdown
    ? ORDER.filter((k) => effectiveBreakdown[k as keyof typeof effectiveBreakdown] != null).map((k) => {
        const raw = Number(effectiveBreakdown[k as keyof typeof effectiveBreakdown])
        const value =
          k === 'competition_density' || k === 'risk_factors'
            ? raw
            : k === 'competition_pressure'
              ? raw === 0 || Number.isNaN(raw)
                ? 0
                : BASE - raw
              : raw
        return {
          key: k,
          label: LABELS[k] ?? k,
          value: Math.round(value),
        }
      })
    : []

  const maxAbs = Math.max(15, ...items.map((i) => Math.abs(i.value)), 1)
  const scaleMax = maxAbs * 1.2

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
      style={{ fontFamily: chartFontFamily }}
      aria-label="기회 점수 분해"
    >
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-5 w-5 text-primary shrink-0" />
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">기회 점수 분해 · 워터폴</h3>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
        기본 50점에서 각 요인의 가감(Δ)을 순차 반영해 최종 점수가 산출됩니다. 파랑은 기준·합계, 녹색은 가점, 빨강은 감점입니다.
      </p>

      <div className="space-y-0">
        <div className="flex items-center gap-3 sm:gap-4 pb-1">
          <span className="text-sm font-medium text-foreground w-28 sm:w-32 shrink-0">{baseLabel}</span>
          <div className="flex-1 h-9 rounded-lg overflow-hidden flex items-center justify-center min-w-0 border border-[#3B5BDB]/40 bg-[#4F6EF7] shadow-sm">
            <span className="text-sm font-bold tabular-nums text-white">{formatChartInt(BASE)}</span>
          </div>
          <span className="text-sm font-bold tabular-nums text-muted-foreground w-12 text-right shrink-0">
            {formatChartInt(BASE)}
          </span>
        </div>

        <div className="flex justify-center py-0.5" aria-hidden>
          <svg width="2" height="14" className="text-slate-300 dark:text-zinc-600">
            <line x1="1" y1="0" x2="1" y2="14" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          </svg>
        </div>

        {items.map(({ key, label, value }, idx) => {
          const isPositive = value >= 0
          const displayValue = value > 0 ? `+${formatChartInt(value)}` : formatChartInt(value)
          const barWidthPct = Math.min(50, (Math.abs(value) / scaleMax) * 50)

          return (
            <div key={key}>
              <div className="flex items-center gap-3 sm:gap-4 py-1">
                <span className="text-sm font-medium text-foreground w-28 sm:w-32 shrink-0">{label}</span>
                <div className="flex-1 h-9 rounded-lg overflow-hidden bg-muted/25 flex items-center relative min-w-0 border border-border/40">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border z-0" aria-hidden />
                  <div
                    className={cn(
                      'absolute top-0 bottom-0 h-full rounded-md flex items-center justify-center z-10 border border-white/20',
                      isPositive ? 'bg-[#10B981]' : 'bg-[#EF4444]'
                    )}
                    style={{
                      width: `${barWidthPct}%`,
                      ...(isPositive ? { left: '50%' } : { right: '50%', left: 'auto' }),
                    }}
                  >
                    <span className="text-xs font-bold tabular-nums text-white drop-shadow-sm px-1">{displayValue}</span>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-sm font-bold tabular-nums w-12 text-right shrink-0',
                    isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {displayValue}
                </span>
              </div>
              <div className="flex justify-center py-0.5" aria-hidden>
                <svg width="2" height={idx === items.length - 1 ? 14 : 12} className="text-slate-300 dark:text-zinc-600">
                  <line x1="1" y1="0" x2="1" y2={idx === items.length - 1 ? 14 : 12} stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                </svg>
              </div>
            </div>
          )
        })}

        <div className="pt-3 mt-1 border-t border-border/80">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-sm font-semibold text-foreground w-28 sm:w-32 shrink-0">{finalLabel}</span>
            <div
              className={cn(
                'flex-1 min-h-[44px] rounded-xl flex items-center justify-center gap-2 min-w-0 px-2',
                'border-[3px] border-[#3B5BDB] bg-[#4F6EF7] shadow-md text-white'
              )}
            >
              {loading && normScore == null ? (
                <span className="flex items-center gap-2 w-full max-w-[200px]">
                  <span className="h-7 flex-1 rounded-md bg-white/25 animate-pulse" aria-hidden />
                </span>
              ) : normScore != null ? (
                <>
                  <span className={cn('text-xl font-bold tabular-nums', analysisFailed && 'opacity-90')}>
                    {formatChartInt(normScore)} / 100
                  </span>
                  <span className="text-xs font-semibold text-white/90">누적 반영 후</span>
                  {analysisFailed ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-md border border-amber-200/50 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100 shrink-0"
                      title="일부 분석 단계가 실패했습니다. 마지막으로 유효한 점수를 표시합니다."
                    >
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      오류
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-xl font-bold tabular-nums text-white/80">0 / 100</span>
              )}
            </div>
            {normScore != null && !loading && (
              <span className="text-lg font-bold tabular-nums w-14 text-right shrink-0 text-[#4F6EF7] dark:text-[#7B93F8]">
                {formatChartInt(normScore)}
              </span>
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
                <ul className="list-inside list-disc space-y-1 text-base leading-relaxed text-foreground">
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
