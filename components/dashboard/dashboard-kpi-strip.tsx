'use client'

import { cn } from '@/lib/utils'
import { dashboardCardClass } from '@/components/dashboard/dashboard-tokens'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import type { DashboardKeywordRow } from '@/app/api/research/dashboard-recommendations/route'
import type { TrendItem } from '@/lib/trends-types'

function avg(nums: number[]): number | null {
  if (!nums.length) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

/** 기회 점수(높을수록 유리) 정성 구간 */
function opportunityLevel(score: number | null): { text: string; className: string } | null {
  if (score == null) return null
  if (score >= 75) return { text: '매우 높음', className: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200' }
  if (score >= 60) return { text: '높음', className: 'bg-[#E8FAF9] text-[#0f766e] dark:bg-teal-950/50 dark:text-teal-200' }
  if (score >= 42) return { text: '보통', className: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300' }
  return { text: '낮음', className: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' }
}

/** 리스크 점수(높을수록 부담 큼) 정성 구간 */
function riskPressureLevel(score: number | null): { text: string; className: string } | null {
  if (score == null) return null
  if (score >= 72) return { text: '매우 높음', className: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200' }
  if (score >= 58) return { text: '높음', className: 'bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200' }
  if (score >= 42) return { text: '보통', className: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300' }
  return { text: '낮음', className: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' }
}

function formatTrendsUpdated(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function KpiCard({
  label,
  value,
  qualityBadge,
  footNote,
  sparkSeed,
  sparkTone,
}: {
  label: string
  value: string
  qualityBadge?: { text: string; className: string } | null
  footNote?: string | null
  sparkSeed: number
  sparkTone: 'blue' | 'emerald' | 'red' | 'mint'
}) {
  return (
    <div className={cn(dashboardCardClass, 'flex min-h-[128px] flex-col justify-between p-4 shadow-sm sm:p-5')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{label}</p>
        <MiniSparkline seed={sparkSeed} tone={sparkTone} className="h-10 w-20 shrink-0 opacity-90" />
      </div>
      <div className="mt-3 space-y-2">
        <span className="block text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl dark:text-zinc-50">
          {value}
        </span>
        {qualityBadge ? (
          <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold', qualityBadge.className)}>
            {qualityBadge.text}
          </span>
        ) : null}
        {footNote ? <p className="text-xs leading-snug text-slate-500 dark:text-zinc-400">{footNote}</p> : null}
      </div>
    </div>
  )
}

export function DashboardKpiStrip({
  opportunities,
  risks,
  trendItems,
  recentAnalysisCount,
  trendsUpdatedAt,
  loading,
}: {
  opportunities: DashboardKeywordRow[]
  risks: DashboardKeywordRow[]
  trendItems: TrendItem[]
  recentAnalysisCount: number
  /** 트렌드 API/캐시 기준 마지막 갱신 시각 */
  trendsUpdatedAt: string | null
  loading: boolean
}) {
  const oppScores = opportunities.slice(0, 5).map((o) => o.opportunity_score)
  const riskScores = risks.slice(0, 5).map((r) => r.risk_score)
  const avgOpp = avg(oppScores)
  const avgRisk = avg(riskScores)
  const oppBadge = opportunityLevel(avgOpp)
  const riskBadge = riskPressureLevel(avgRisk)

  const trendCount = trendItems.length
  const updatedStr = formatTrendsUpdated(trendsUpdatedAt)
  const trendFoot =
    loading
      ? '데이터를 불러오는 중입니다.'
      : trendCount === 0
        ? '표시할 트렌드가 없습니다.'
        : updatedStr
          ? `전체 ${trendCount}건 · 피드 갱신 ${updatedStr}`
          : `전체 ${trendCount}건 · 최근 업데이트 완료`

  const recentFoot =
    recentAnalysisCount === 0
      ? '아직 표시할 최근 분석이 없습니다.'
      : `대시보드에 최근 ${recentAnalysisCount}건 표시`

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn(dashboardCardClass, 'h-[128px] animate-pulse bg-slate-50 shadow-sm dark:bg-zinc-900')} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <KpiCard
        label="상위 기회 지수"
        value={avgOpp != null ? String(avgOpp) : '—'}
        qualityBadge={oppBadge}
        footNote={avgOpp == null ? '코호트 데이터가 쌓이면 평균 점수가 표시됩니다.' : '상위 5개 키워드 기회 점수 평균'}
        sparkSeed={avgOpp ?? 42}
        sparkTone="emerald"
      />
      <KpiCard
        label="리스크 압력"
        value={avgRisk != null ? String(avgRisk) : '—'}
        qualityBadge={riskBadge}
        footNote={avgRisk == null ? '리스크 코호트가 없습니다.' : '상위 5개 키워드 리스크 점수 평균'}
        sparkSeed={avgRisk ?? 17}
        sparkTone="red"
      />
      <KpiCard
        label="트렌드 피드"
        value={String(trendCount)}
        footNote={trendFoot}
        sparkSeed={trendCount * 7 + 3}
        sparkTone="blue"
      />
      <KpiCard
        label="최근 분석"
        value={String(recentAnalysisCount)}
        footNote={recentFoot}
        sparkSeed={recentAnalysisCount * 11}
        sparkTone="mint"
      />
    </div>
  )
}
