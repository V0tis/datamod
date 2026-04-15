'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CollapsibleAnalysisPipelineProps {
  /** 접힌 헤더 제목 */
  title: string
  /** 보조 한 줄 (큐 대기 등) */
  sub?: string
  /** 0–100 미니 진행률 */
  progressPercent: number
  /** 큐 대기 시 접힌 바에도 표시 */
  queueWaiting: boolean
  allCompleted: boolean
  hasError: boolean
  pipelineInFlight: boolean
  /** 리포트 변경 시 접기 초기화용 */
  reportId: string | null
  /** 에러 발생 시 자동 펼침 */
  autoExpandOnError: boolean
  hasFailedTask: boolean
  children: ReactNode
}

/**
 * 분석 단계 타임라인: 기본 접힘, 헤더에 요약·미니 진행률·토글.
 */
export function CollapsibleAnalysisPipeline({
  title,
  sub,
  progressPercent,
  queueWaiting,
  allCompleted,
  hasError,
  pipelineInFlight,
  reportId,
  autoExpandOnError,
  hasFailedTask,
  children,
}: CollapsibleAnalysisPipelineProps) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [reportId])

  useEffect(() => {
    if (autoExpandOnError && (hasError || hasFailedTask)) {
      setExpanded(true)
    }
  }, [autoExpandOnError, hasError, hasFailedTask])

  const toggle = () => setExpanded((e) => !e)

  const statusIcon = hasError || hasFailedTask ? (
    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
  ) : allCompleted ? (
    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
  ) : pipelineInFlight ? (
    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600 dark:text-blue-400" aria-hidden />
  ) : (
    <Sparkles className="h-4 w-4 shrink-0 text-slate-500 dark:text-zinc-400" aria-hidden />
  )

  return (
    <div
      className={cn(
        'relative z-[40] w-full rounded-xl border border-slate-200/90 bg-[#FFFFFF] shadow-sm dark:border-zinc-800 dark:bg-zinc-950'
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors sm:px-5 sm:py-4',
          'hover:bg-slate-50/90 dark:hover:bg-zinc-900/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        aria-expanded={expanded}
        aria-controls="analysis-pipeline-details"
        id="analysis-pipeline-toggle"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/80">
          {statusIcon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
              분석 파이프라인
            </span>
            <span className="text-sm font-medium text-slate-700 dark:text-zinc-200">{title}</span>
            {queueWaiting && !expanded ? (
              <span className="inline-flex items-center rounded-full bg-sky-100/90 px-2 py-0.5 text-[10px] font-semibold text-sky-900 dark:bg-sky-950/60 dark:text-sky-100">
                다음 단계 준비 중…
              </span>
            ) : null}
          </span>
          {sub ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span>
          ) : null}
          <span className="mt-3 block">
            <span className="sr-only">전체 진행률 {Math.round(progressPercent)}퍼센트</span>
            <span
              className="relative block h-1.5 w-full overflow-hidden rounded-full bg-slate-200/90 dark:bg-zinc-800"
              aria-hidden
            >
              <motion.span
                className={cn(
                  'absolute left-0 top-0 h-full rounded-full',
                  hasError || hasFailedTask
                    ? 'bg-red-500'
                    : allCompleted
                      ? 'bg-emerald-500'
                      : 'bg-blue-500'
                )}
                initial={false}
                animate={{ width: `${Math.min(100, Math.max(2, progressPercent))}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 22 }}
              />
            </span>
          </span>
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-1 text-muted-foreground">
          <span className="text-[11px] font-medium tabular-nums">{Math.round(progressPercent)}%</span>
          {expanded ? (
            <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
          )}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id="analysis-pipeline-details"
            role="region"
            aria-labelledby="analysis-pipeline-toggle"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-slate-100 dark:border-zinc-800"
          >
            <div className="px-4 pb-4 pt-1 sm:px-5 sm:pb-5">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
