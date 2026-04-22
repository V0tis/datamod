'use client'

import { Target, Info, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { chartFontFamily, formatChartInt } from '@/lib/chartTheme'
import {
  OpportunityWaterfallSvg,
  type WaterfallSegment,
} from '@/components/research/OpportunityWaterfallSvg'

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
  /** true면 섹션 제목·설명 숨김(상위「시장 분석」헤더만 사용) */
  embedded?: boolean
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

function buildWaterfallSegments(
  items: { label: string; value: number }[],
  target: number | null
): WaterfallSegment[] {
  const t = target != null ? Math.round(Math.min(100, Math.max(0, target))) : BASE
  const totalDelta = t - BASE
  const segs: WaterfallSegment[] = [{ label: '기준선', start: 0, end: BASE, kind: 'total' }]
  if (items.length === 0) {
    segs.push({ label: '최종 점수', start: 0, end: t, kind: 'final' })
    return segs
  }
  const weights = items.map((i) => Math.max(0.1, Math.abs(i.value)))
  const sumW = weights.reduce((a, b) => a + b, 0)
  let running = BASE
  for (let i = 0; i < items.length; i++) {
    const mag = sumW > 0 ? (Math.abs(totalDelta) * weights[i]) / sumW : 0
    const sign = items[i].value >= 0 ? 1 : -1
    const d = sign * mag
    const next = Math.round((running + d) * 10) / 10
    const clamped = Math.min(100, Math.max(0, next))
    segs.push({
      label: items[i].label,
      start: running,
      end: clamped,
      kind: 'floating',
    })
    running = clamped
  }
  const drift = t - running
  if (Math.abs(drift) > 0.2 && segs.length > 1) {
    const lastFloat = segs[segs.length - 1]!
    if (lastFloat.kind === 'floating') {
      lastFloat.end = Math.round(Math.min(100, Math.max(0, lastFloat.end + drift)) * 10) / 10
    }
  }
  segs.push({ label: '최종 점수', start: 0, end: t, kind: 'final' })
  return segs
}

export function OpportunityScoreBreakdown({
  score,
  loading = false,
  stableScore = null,
  analysisFailed = false,
  embedded = false,
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

  const waterfallSegments = buildWaterfallSegments(items, normScore)

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
      {!embedded ? (
        <>
          <div className="mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 shrink-0 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">기회 점수 분해 · 워터폴</h3>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            기본 50점에서 각 요인의 가감(Δ)을 순차 반영해 최종 점수가 산출됩니다. 파랑은 기준·최종 합계, 녹색은 가점, 빨강은 감점입니다.
          </p>
        </>
      ) : null}

      <div className="w-full min-w-0">
        {loading && normScore == null && !analysisFailed ? (
          <div className="flex h-[140px] w-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20">
            <span className="text-sm text-muted-foreground">점수 산출 중…</span>
          </div>
        ) : (
          <OpportunityWaterfallSvg segments={waterfallSegments} height={140} finalLabel="최종 점수" />
        )}
        {normScore != null && !loading && analysisFailed ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            일부 분석 단계가 실패했습니다. 마지막으로 유효한 점수를 반영했습니다.
          </p>
        ) : null}
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
