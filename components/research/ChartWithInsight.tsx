'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface ChartInsightData {
  insight?: string
  takeaway?: string
}

export interface ChartWithInsightProps {
  /** 차트 상단 고정: AI PM 한 줄 해석 */
  pmCaption?: string | null
  /** Chart title */
  title: string
  /** AI-generated insight summary (1-2 sentences) */
  insight?: string | null
  /** AI-generated key takeaway */
  takeaway?: string | null
  /** Chart content (React node) */
  children: React.ReactNode
  className?: string
  /** 제목 옆·아래 액션(예: 데이터 출처 버튼) */
  headerActions?: React.ReactNode
  /** `flat`: 테두리·배경만으로 구분 (중첩 카드 느낌 완화) */
  variant?: 'default' | 'flat'
  /** 산출 로직 요약 — [i] 툴팁 */
  logicHint?: string | null
  /** 차트 제목 바로 아래 한 줄 설명 (13px, 회색) */
  description?: string | null
}

/**
 * Wraps a chart with Chart Title, AI Insight Summary, and Key Takeaway.
 */
export function ChartWithInsight({
  pmCaption,
  title,
  insight,
  takeaway,
  children,
  className,
  headerActions,
  variant = 'default',
  logicHint,
  description,
}: ChartWithInsightProps) {
  const hasInsight = Boolean(insight?.trim() || takeaway?.trim())
  const flat = variant === 'flat'
  const hint = logicHint?.trim()
  const desc = description?.trim()

  const cap = pmCaption?.trim()

  return (
    <div
      className={cn(
        flat
          ? 'rounded-lg border border-slate-100 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-950/50'
          : 'rounded-xl border border-border/60 bg-white p-4 dark:bg-zinc-950/40',
        className
      )}
    >
      {cap ? (
        <div className="mb-3 rounded-lg border border-zinc-200/80 bg-zinc-50/90 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
            AI PM의 한 줄 평
          </p>
          <p className="mt-1 text-sm font-medium leading-snug text-zinc-800 dark:text-zinc-100">{cap}</p>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {title}
          </h4>
          {hint ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground dark:hover:bg-zinc-800"
                    aria-label="이 데이터는 어떻게 산출되었는가"
                  >
                    <Info className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                  {hint}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </div>
      {desc ? (
        <p className="mb-3 text-[13px] leading-snug text-[#6B7280] dark:text-zinc-400">{desc}</p>
      ) : null}
      <div className="mb-3">{children}</div>
      {hasInsight && (
        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
          {insight?.trim() && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                인사이트
              </p>
              <p className="text-sm text-foreground leading-relaxed">{insight.trim()}</p>
            </div>
          )}
          {takeaway?.trim() && (
            <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
              <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">
                핵심 포인트
              </p>
              <p className="text-sm text-foreground leading-relaxed font-medium">{takeaway.trim()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
