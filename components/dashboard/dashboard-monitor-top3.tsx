'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronRight, Target, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardCardClass } from '@/components/dashboard/dashboard-tokens'
import type { DashboardKeywordRow } from '@/app/api/research/dashboard-recommendations/route'

type Country = string

export function DashboardMonitorTop3({
  opportunities,
  risks,
  trendCountry,
  loading,
  opportunityInsightTag,
  riskInsightTag,
}: {
  opportunities: DashboardKeywordRow[]
  risks: DashboardKeywordRow[]
  trendCountry: Country
  loading: boolean
  opportunityInsightTag: (score: number) => string
  riskInsightTag: (score: number) => string
}) {
  const oppTop = opportunities.slice(0, 3)
  const riskTop = risks.slice(0, 3)

  return (
    <div className="flex flex-col gap-5">
      <MonitorBlock
        title="고기회 시장 TOP 3"
        icon={<Target className="h-4 w-4 text-emerald-600" aria-hidden />}
        accentClass="text-emerald-600"
        loading={loading}
        rowCount={oppTop.length}
        empty="완료된 분석이 쌓이면 상위 기회 키워드가 표시됩니다."
      >
        {oppTop.map((row, i) => (
          <Link
            key={`opp-${row.keyword}-${i}`}
            href={`/results?keyword=${encodeURIComponent(row.keyword)}&country=${encodeURIComponent(trendCountry)}`}
            className={cn(
              dashboardCardClass,
              'flex items-center gap-3 p-4 transition-shadow hover:shadow-md'
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-bold text-slate-900 dark:text-zinc-50">{row.keyword}</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {opportunityInsightTag(row.opportunity_score)}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">{row.analysis_count}건 데이터</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{row.opportunity_score}</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                <BookOpen className="h-3 w-3" aria-hidden />
                출처
              </span>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-zinc-600" aria-hidden />
          </Link>
        ))}
      </MonitorBlock>

      <MonitorBlock
        title="고리스크 시장 TOP 3"
        icon={<AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />}
        accentClass="text-red-600"
        loading={loading}
        rowCount={riskTop.length}
        empty="경쟁·포화 신호가 뚜렷한 키워드가 여기에 표시됩니다."
      >
        {riskTop.map((row, i) => (
          <Link
            key={`risk-${row.keyword}-${i}`}
            href={`/results?keyword=${encodeURIComponent(row.keyword)}&country=${encodeURIComponent(trendCountry)}`}
            className={cn(dashboardCardClass, 'flex items-center gap-3 p-4 transition-shadow hover:shadow-md')}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-sm font-bold text-slate-900 dark:text-zinc-50">{row.keyword}</span>
              <span className="w-fit rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {riskInsightTag(row.risk_score)}
              </span>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{row.risk_score}</span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400 dark:text-zinc-500">
                <BookOpen className="h-3 w-3" aria-hidden />
                출처
              </span>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-zinc-600" aria-hidden />
          </Link>
        ))}
      </MonitorBlock>

      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
        출처: 완료된 리서치의 기회·경쟁 지표. 카드 선택 시 상세 리포트로 이동합니다.
      </p>
    </div>
  )
}

function MonitorBlock({
  title,
  icon,
  accentClass,
  loading,
  rowCount,
  empty,
  children,
}: {
  title: string
  icon: ReactNode
  accentClass: string
  loading: boolean
  rowCount: number
  empty: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <span className={accentClass}>{icon}</span>
        <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-50">{title}</h2>
      </div>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn(dashboardCardClass, 'h-16 animate-pulse bg-slate-50 dark:bg-zinc-900')} />
          ))}
        </div>
      ) : rowCount === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-4 py-6 text-center text-xs text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}
