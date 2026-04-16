'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronRight, Target, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardCardClass } from '@/components/dashboard/dashboard-tokens'
import type { DashboardKeywordRow } from '@/lib/types/dashboard-keyword-row'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'

type Country = string

function seedFromKeyword(keyword: string, salt: number) {
  let h = salt
  for (let i = 0; i < keyword.length; i++) {
    h = (h << 5) - h + keyword.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

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
    <div className="flex flex-col gap-8">
      <MonitorBlock
        title="고기회 시장 TOP 3"
        icon={<Target className="h-4 w-4 text-emerald-600" aria-hidden />}
        accentClass="text-emerald-600"
        loading={loading}
        rowCount={oppTop.length}
        empty="시장 분석을 마치면 실시간 인사이트 기준 기회 키워드가 표시됩니다."
      >
        {oppTop.map((row, i) => (
          <Link
            key={`opp-${row.keyword}-${i}`}
            href={`/results?keyword=${encodeURIComponent(row.keyword)}&country=${encodeURIComponent(trendCountry)}`}
            className="flex min-h-[48px] items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[#F8F9FA] sm:gap-3 sm:px-4 dark:hover:bg-zinc-900/80"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-[#222] dark:text-zinc-50">{row.keyword}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400">
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  {opportunityInsightTag(row.opportunity_score)}
                </span>
                <span className="hidden sm:inline">· {row.analysis_count}건</span>
              </div>
            </div>
            <MiniSparkline
              seed={seedFromKeyword(row.keyword, 11)}
              tone="emerald"
              endValue={row.opportunity_score}
              className="h-9 w-[52px] sm:w-[72px] shrink-0 opacity-95"
            />
            <span className="shrink-0 text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {row.opportunity_score}
            </span>
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
            className="flex min-h-[48px] items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[#F8F9FA] sm:gap-3 sm:px-4 dark:hover:bg-zinc-900/80"
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-red-100 text-[10px] font-bold text-red-800 dark:bg-red-950/50 dark:text-red-200"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-[#222] dark:text-zinc-50">{row.keyword}</p>
              <span className="mt-0.5 inline-block rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {riskInsightTag(row.risk_score)}
              </span>
            </div>
            <MiniSparkline
              seed={seedFromKeyword(row.keyword, 29)}
              tone="red"
              endValue={row.risk_score}
              className="h-9 w-[52px] sm:w-[72px] shrink-0 opacity-95"
            />
            <span className="shrink-0 text-base font-bold tabular-nums text-red-600 dark:text-red-400">{row.risk_score}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 dark:text-zinc-600" aria-hidden />
          </Link>
        ))}
      </MonitorBlock>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400">
        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        최근 시장 분석·인사이트 기준 · 행 선택 시 상세 리포트로 이동합니다.
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
        <div className={cn(dashboardCardClass, 'divide-y divide-[#E8EAED] overflow-hidden shadow-sm dark:divide-zinc-800')}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse bg-slate-50/80 px-4 dark:bg-zinc-900/80" />
          ))}
        </div>
      ) : rowCount === 0 ? (
        <p className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-4 py-6 text-center text-xs text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {empty}
        </p>
      ) : (
        <div
          className={cn(
            dashboardCardClass,
            'divide-y divide-[#E8EAED] overflow-hidden p-0 shadow-sm dark:divide-zinc-800'
          )}
        >
          {children}
        </div>
      )}
    </section>
  )
}
