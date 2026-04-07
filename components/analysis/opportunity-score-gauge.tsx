'use client'

import { Info, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function OpportunityScoreGauge({
  score,
  loading,
  /** 마지막으로 유효했던 점수 (부분 실패·재시도 시 UI 유지) */
  stableScore,
  /** 분석 실패 등으로 현재 점수를 신뢰할 수 없을 때 */
  analysisFailed = false,
  /** 짧은 산출 근거 (title 툴팁 + 보조 설명) */
  rationaleSummary,
  className,
}: {
  score: number | null
  loading?: boolean
  stableScore?: number | null
  analysisFailed?: boolean
  rationaleSummary?: string | null
  className?: string
}) {
  const effective =
    score != null && Number.isFinite(score)
      ? score
      : analysisFailed && stableScore != null && Number.isFinite(stableScore)
        ? stableScore
        : null
  const pct =
    loading && effective == null
      ? null
      : effective != null
        ? Math.min(100, Math.max(0, Math.round(effective)))
        : null
  const circumference = 2 * Math.PI * 44
  const offset = pct == null ? circumference : circumference - (pct / 100) * circumference
  const showSkeleton = loading && effective == null
  const showProvisionalZero = !loading && !analysisFailed && effective == null
  const tooltipText =
    (rationaleSummary?.trim() ||
      '검색 수요, 시장 성장, 경쟁, 투자 신호, 리스크 요인을 기본 50점에 반영해 산출됩니다. 아래 기회 점수 분해에서 단계별 가감을 확인할 수 있습니다.') +
    (analysisFailed && stableScore != null ? ' (일부 단계 오류로 이전 유효 점수를 표시합니다.)' : '')

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
              showSkeleton && 'opacity-30',
              pct != null && !analysisFailed && pct >= 70 ? 'text-emerald-500' : pct != null && !analysisFailed && pct >= 40 ? 'text-sky-500' : pct != null ? 'text-amber-500' : 'text-slate-200 dark:text-zinc-700'
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          {showSkeleton ? (
            <span className="h-9 w-14 rounded-md bg-slate-200/90 animate-pulse dark:bg-zinc-700/80" aria-hidden />
          ) : pct != null ? (
            <>
              <span
                className={cn(
                  'text-3xl font-bold tabular-nums text-slate-900 dark:text-zinc-50',
                  analysisFailed && 'opacity-85'
                )}
              >
                {pct}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">점</span>
            </>
          ) : showProvisionalZero ? (
            <>
              <span className="text-3xl font-bold tabular-nums text-slate-300 dark:text-zinc-600">0</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">점</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-400 dark:text-zinc-500">—</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
        <p className="text-xs text-slate-500 dark:text-zinc-400">최종 기회 점수</p>
        <span
          className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          title={tooltipText}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
        {analysisFailed ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            일부 오류
          </span>
        ) : null}
      </div>
      {rationaleSummary?.trim() ? (
        <p className="max-w-[260px] text-center text-[11px] leading-snug text-slate-500 dark:text-zinc-500 line-clamp-3">
          {rationaleSummary.trim()}
        </p>
      ) : null}
    </div>
  )
}
