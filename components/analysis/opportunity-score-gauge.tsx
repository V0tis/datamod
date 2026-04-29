'use client'

import { useEffect, useState } from 'react'
import { animate, motion } from 'framer-motion'
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

  const [displayPct, setDisplayPct] = useState<number | null>(null)

  useEffect(() => {
    if (pct == null) {
      setDisplayPct(null)
      return
    }
    setDisplayPct(0)
    const controls = animate(0, pct, {
      duration: 0.85,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplayPct(Math.round(v)),
    })
    return () => controls.stop()
  }, [pct])

  const circumference = 2 * Math.PI * 44
  const ringPct = displayPct != null ? Math.min(100, Math.max(0, displayPct)) : null
  const offset = ringPct == null ? circumference : circumference - (ringPct / 100) * circumference
  const showSkeleton = loading && effective == null
  const showProvisionalZero = !loading && !analysisFailed && effective == null
  const tooltipText =
    (rationaleSummary?.trim() ||
      '검색 수요, 시장 성장, 경쟁, 투자 신호, 리스크 요인을 기본 50점에 반영해 산출됩니다. 아래 기회 점수 분해에서 단계별 가감을 확인할 수 있습니다.') +
    (analysisFailed && stableScore != null ? ' (일부 단계 오류로 이전 유효 점수를 표시합니다.)' : '')

  return (
    <motion.div
      className={cn('flex flex-col items-center gap-2', className)}
      initial={{ opacity: 0.88, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <div className="relative h-[120px] w-[120px]">
        <svg className="-rotate-90 transform" width="120" height="120" viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r="44" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 " />
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
              'transition-[stroke-dashoffset] duration-150 ease-out',
              showSkeleton && 'opacity-30',
              ringPct != null && !analysisFailed && ringPct >= 70 ? 'text-emerald-500' : ringPct != null && !analysisFailed && ringPct >= 40 ? 'text-sky-500' : ringPct != null ? 'text-amber-500' : 'text-slate-200 '
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-1">
          {showSkeleton ? (
            <span className="h-9 w-14 rounded-md bg-slate-200/90 animate-pulse " aria-hidden />
          ) : ringPct != null ? (
            <>
              <span
                className={cn(
                  'text-3xl font-bold tabular-nums text-slate-900 ',
                  analysisFailed && 'opacity-85'
                )}
              >
                {displayPct ?? ringPct}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">점</span>
            </>
          ) : showProvisionalZero ? (
            <>
              <span className="text-3xl font-bold tabular-nums text-slate-300 ">0</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">점</span>
            </>
          ) : (
            <span className="text-lg font-semibold text-slate-400 ">—</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-center">
        <p className="text-xs text-slate-500 ">최종 기회 점수</p>
        <span
          className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:text-slate-600  "
          title={tooltipText}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
        {analysisFailed ? (
          <span className="inline-flex items-center gap-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 ">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            일부 오류
          </span>
        ) : null}
      </div>
      {rationaleSummary?.trim() ? (
        <p className="max-w-[260px] text-center text-[11px] leading-snug text-slate-500  line-clamp-3">
          {rationaleSummary.trim()}
        </p>
      ) : null}
    </motion.div>
  )
}
