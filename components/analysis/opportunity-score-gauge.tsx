'use client'

import { cn } from '@/lib/utils'

export function OpportunityScoreGauge({
  score,
  loading,
  className,
}: {
  score: number | null
  loading?: boolean
  className?: string
}) {
  const pct = loading || score == null || !Number.isFinite(score) ? null : Math.min(100, Math.max(0, Math.round(score)))
  const circumference = 2 * Math.PI * 44
  const offset = pct == null ? circumference : circumference - (pct / 100) * circumference

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative h-[120px] w-[120px]">
        <svg className="-rotate-90 transform" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-zinc-800" />
          <circle
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset ?? circumference}
            className={cn(
              'transition-[stroke-dashoffset] duration-700 ease-out',
              pct != null && pct >= 70 ? 'text-emerald-500' : pct != null && pct >= 40 ? 'text-sky-500' : 'text-amber-500'
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {loading || pct == null ? (
            <span className="text-lg font-semibold text-slate-400">—</span>
          ) : (
            <>
              <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-zinc-50">{pct}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">점</span>
            </>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-zinc-400">최종 기회 점수</p>
    </div>
  )
}
