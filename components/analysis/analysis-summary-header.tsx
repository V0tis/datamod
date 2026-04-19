'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'
import { urgencyToPriorityLevel } from '@/lib/research-priority-outcomes'
import { breakdownDimensionTo10, formatPrimaryScore100 } from '@/lib/score-display'
import { DimensionScoreBar } from '@/components/analysis/dimension-score-bar'

const P_BADGE: Record<0 | 1 | 2, string> = {
  0: 'border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100',
  1: 'border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
  2: 'border-border bg-muted text-muted-foreground dark:bg-zinc-800 dark:text-zinc-200',
}

function formatAnalysisDate(iso?: string | null): string | null {
  if (!iso?.trim()) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function AnalysisMetaRow({
  keyword,
  countryCode,
  updatedAt,
  className,
}: {
  keyword: string
  countryCode: string
  updatedAt?: string | null
  className?: string
}) {
  const dateLine = formatAnalysisDate(updatedAt)
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-zinc-400', className)}>
      <span className="font-semibold text-slate-900 dark:text-zinc-100">&quot;{keyword.trim()}&quot;</span>
      <span className="text-muted-foreground">·</span>
      <span>국가 {countryCode}</span>
      {dateLine ? (
        <>
          <span className="text-muted-foreground">·</span>
          <span>분석일 {dateLine}</span>
        </>
      ) : null}
    </div>
  )
}

export function SummaryStatPills({ result }: { result: ResearchResponse | null }) {
  const km = result?.key_metrics ?? {}
  const b = km.opportunity_score_breakdown ?? {}
  const growth10 = breakdownDimensionTo10(typeof b.market_growth === 'number' ? b.market_growth : undefined)
  const trend10 = breakdownDimensionTo10(typeof b.trend_momentum === 'number' ? b.trend_momentum : undefined)
  const marketDim = growth10 ?? trend10
  const compRaw =
    typeof b.competition_density === 'number'
      ? b.competition_density
      : typeof b.competition_pressure === 'number'
        ? b.competition_pressure
        : undefined
  const competition10 = breakdownDimensionTo10(compRaw)
  const opp = typeof km.opportunity_score === 'number' && Number.isFinite(km.opportunity_score) ? km.opportunity_score : null

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">시장 성장성</p>
        {marketDim != null ? (
          <DimensionScoreBar value10={marketDim} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">경쟁 강도</p>
        {competition10 != null ? (
          <DimensionScoreBar value10={competition10} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        )}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">시장 기회</p>
        {opp != null ? (
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-foreground">{formatPrimaryScore100(opp)}</p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  )
}

export function TopPmActionsStrip({
  result,
  taskData,
  analysisTasks,
  className,
}: {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Parameters<typeof extractNextActionItems>[2]
  className?: string
}) {
  const rows = useMemo(() => {
    return extractNextActionItems(result, taskData, analysisTasks, { maxItems: 12 })
      .filter((a) => a.action?.trim())
      .map((a) => ({
        p: urgencyToPriorityLevel(a.priority),
        title: a.action.trim(),
      }))
      .sort((x, y) => x.p - y.p)
      .slice(0, 3)
  }, [result, taskData, analysisTasks])

  if (rows.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">우선 PM 액션</p>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={`${r.title}-${i}`}
            className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950/60"
          >
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold',
                P_BADGE[r.p as 0 | 1 | 2]
              )}
            >
              P{r.p}
            </span>
            <span className="min-w-0 leading-snug text-foreground">{r.title}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
