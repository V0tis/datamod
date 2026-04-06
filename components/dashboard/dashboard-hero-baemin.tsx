'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardHeroBg, dashboardMint, dashboardMintSoft } from '@/components/dashboard/dashboard-tokens'

export function DashboardHeroBaemin({
  displayName,
  strongOppCount,
  strongRiskCount,
  className,
}: {
  displayName: string
  strongOppCount: number
  strongRiskCount: number
  className?: string
}) {
  return (
    <section
      className={cn(dashboardHeroBg, 'px-5 py-6 sm:px-8 sm:py-7', className)}
      aria-labelledby="dash-hero-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">오늘의 시장 보드</p>
          <h1
            id="dash-hero-title"
            className="text-[1.35rem] font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl dark:text-zinc-50"
          >
            환영합니다,{' '}
            <span className="whitespace-nowrap" style={{ color: dashboardMint }}>
              {displayName}
            </span>
            님.
            <span className="mt-1 block text-base font-semibold text-slate-800 sm:mt-2 sm:text-lg dark:text-zinc-200">
              오늘 RIN-AI가 포착한 핵심 시장 시그널입니다.
            </span>
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            총{' '}
            <strong className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{strongOppCount}</strong>
            개의 고기회 시장과{' '}
            <strong className="font-bold tabular-nums text-red-600 dark:text-red-400">{strongRiskCount}</strong>
            개의 고리스크 시장이 감지되었습니다.
          </p>
        </div>
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16"
          style={{ backgroundColor: dashboardMintSoft }}
          aria-hidden
        >
          <Sparkles className="h-7 w-7 sm:h-8 sm:w-8" style={{ color: dashboardMint }} />
        </div>
      </div>
    </section>
  )
}
