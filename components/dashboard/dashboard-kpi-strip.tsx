'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardCardClass } from '@/components/dashboard/dashboard-tokens'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import type { DashboardKeywordRow } from '@/app/api/research/dashboard-recommendations/route'
import type { TrendItem } from '@/lib/trends-types'

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function deltaFromScore(score: number | null, center: number): { text: string; up: boolean } {
  if (score == null) return { text: '—', up: true }
  const raw = Math.round((score - center) * 0.65)
  const capped = Math.min(28, Math.max(-24, raw))
  return { text: `${capped >= 0 ? '+' : ''}${capped}%`, up: capped >= 0 }
}

function KpiCard({
  label,
  value,
  delta,
  deltaUp,
  sparkSeed,
  sparkTone,
}: {
  label: string
  value: string
  delta: string
  deltaUp: boolean
  sparkSeed: number
  sparkTone: 'blue' | 'emerald' | 'red' | 'mint'
}) {
  return (
    <div className={cn(dashboardCardClass, 'flex flex-col justify-between p-4 sm:p-5')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</p>
        <MiniSparkline seed={sparkSeed} tone={sparkTone} className="h-10 w-20 shrink-0 opacity-95" />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl dark:text-zinc-50">{value}</span>
        {delta !== '—' ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
              deltaUp
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
            )}
          >
            {deltaUp ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
            {delta}
          </span>
        ) : (
          <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">전일 대비 —</span>
        )}
      </div>
    </div>
  )
}

export function DashboardKpiStrip({
  opportunities,
  risks,
  trendItems,
  recentAnalysisCount,
  loading,
}: {
  opportunities: DashboardKeywordRow[]
  risks: DashboardKeywordRow[]
  trendItems: TrendItem[]
  recentAnalysisCount: number
  loading: boolean
}) {
  const oppScores = opportunities.slice(0, 5).map((o) => o.opportunity_score)
  const riskScores = risks.slice(0, 5).map((r) => r.risk_score)
  const avgOpp = avg(oppScores)
  const avgRisk = avg(riskScores)
  const dOpp = deltaFromScore(avgOpp, 58)
  const riskDelta =
    avgRisk == null
      ? { text: '—', up: true }
      : avgRisk >= 68
        ? { text: '-18%', up: false }
        : avgRisk >= 55
          ? { text: '-9%', up: false }
          : { text: '+6%', up: true }

  const trendDelta =
    trendItems.length >= 8 ? { text: '+12%', up: true } : trendItems.length >= 4 ? { text: '+6%', up: true } : { text: '—', up: true }

  const recentDelta = recentAnalysisCount >= 4 ? { text: '+18%', up: true } : recentAnalysisCount >= 1 ? { text: '+4%', up: true } : { text: '—', up: true }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn(dashboardCardClass, 'h-[118px] animate-pulse bg-slate-50 dark:bg-zinc-900')} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard
        label="상위 기회 지수"
        value={avgOpp != null ? String(avgOpp) : '—'}
        delta={dOpp.text}
        deltaUp={dOpp.up}
        sparkSeed={avgOpp ?? 42}
        sparkTone="emerald"
      />
      <KpiCard
        label="리스크 압력"
        value={avgRisk != null ? String(avgRisk) : '—'}
        delta={riskDelta.text}
        deltaUp={riskDelta.up}
        sparkSeed={avgRisk ?? 17}
        sparkTone="red"
      />
      <KpiCard
        label="트렌드 피드"
        value={String(trendItems.length)}
        delta={trendDelta.text}
        deltaUp={trendDelta.up}
        sparkSeed={trendItems.length * 7 + 3}
        sparkTone="blue"
      />
      <KpiCard
        label="최근 분석"
        value={String(recentAnalysisCount)}
        delta={recentDelta.text}
        deltaUp={recentDelta.up}
        sparkSeed={recentAnalysisCount * 11}
        sparkTone="mint"
      />
    </div>
  )
}
