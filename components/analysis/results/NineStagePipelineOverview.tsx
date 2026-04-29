'use client'

import { NINE_PIPELINE_STAGES } from '@/lib/analysis/pipeline-nine-stage'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * 9단계 엔진 파이프라인(준비~검증) — Deep 모드 결과에서만 강조 표시.
 */
export function NineStagePipelineOverview({
  className,
  currentStageIndex = 8,
}: {
  className?: string
  /** 0~8, 완료 시 8(검증) */
  currentStageIndex?: number
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-indigo-200/70 bg-gradient-to-b from-indigo-50/80 to-white p-4 shadow-sm   ',
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 ">9단계 분석 파이프라인</h3>
        <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-600 ">
          Deep research path
        </span>
      </div>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="9단계 파이프라인">
        {NINE_PIPELINE_STAGES.map((s, i) => {
          const done = i <= currentStageIndex
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs',
                done
                  ? 'border-indigo-200/80 bg-white/80  '
                  : 'border-slate-100 bg-slate-50/50 opacity-60  '
              )}
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white "
                aria-hidden
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900 ">
                  {s.label} <span className="text-slate-400">·</span> {s.subtitle}
                </p>
                {done ? (
                  <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600 ">
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                    반영
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
