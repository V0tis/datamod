'use client'

import { cn } from '@/lib/utils'

const cardStyle =
  'rounded-[12px] border border-[#E5E9F2] bg-white/90 shadow-[0_1px_4px_rgba(0,0,0,0.06)] backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-950/90'

export function DashboardHeroPro({
  displayName,
  marketSignalCount,
  highOpportunityCount,
  highRiskCount,
  trendSignalCount,
  onNewAnalysis,
  className,
}: {
  displayName: string
  marketSignalCount: number
  highOpportunityCount: number
  highRiskCount: number
  trendSignalCount: number
  onNewAnalysis: () => void
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex min-h-[120px] w-full flex-col gap-4 rounded-[12px] border border-[#E5E9F2] bg-gradient-to-r from-[#F0F4FF] to-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-950',
        className
      )}
      aria-labelledby="dash-hero-pro-title"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h1 id="dash-hero-pro-title" className="text-[20px] font-bold leading-tight tracking-tight text-[#111827] dark:text-zinc-50">
          안녕하세요, {displayName}님 👋
        </h1>
        <p className="text-[14px] text-[#6B7280] dark:text-zinc-400">
          오늘{' '}
          <span className="font-semibold tabular-nums text-[#374151] dark:text-zinc-300">{marketSignalCount}</span>
          개의 시장 시그널이 감지되었습니다
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-center md:flex-1">
        <span className={cn(cardStyle, 'inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[#374151] dark:text-zinc-200')}>
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          고기회 시장{' '}
          <span className="text-[28px] font-bold leading-none text-[#111827] [font-variant-numeric:tabular-nums] dark:text-zinc-50">
            {highOpportunityCount}
          </span>
          개
        </span>
        <span className={cn(cardStyle, 'inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[#374151] dark:text-zinc-200')}>
          <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
          고리스크{' '}
          <span className="text-[28px] font-bold leading-none text-[#111827] [font-variant-numeric:tabular-nums] dark:text-zinc-50">{highRiskCount}</span>
          개
        </span>
        <span className={cn(cardStyle, 'inline-flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-[#374151] dark:text-zinc-200')}>
          <span className="h-2 w-2 rounded-full bg-sky-500" aria-hidden />
          트렌드 신호{' '}
          <span className="text-[28px] font-bold leading-none text-[#111827] [font-variant-numeric:tabular-nums] dark:text-zinc-50">{trendSignalCount}</span>
          개
        </span>
      </div>

      <div className="flex shrink-0 justify-end sm:pl-2">
        <button
          type="button"
          onClick={onNewAnalysis}
          className="inline-flex h-11 min-w-[140px] items-center justify-center rounded-[12px] bg-[#2563EB] px-5 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
        >
          새 분석 시작
        </button>
      </div>
    </section>
  )
}
