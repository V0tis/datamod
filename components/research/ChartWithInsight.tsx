'use client'

import { cn } from '@/lib/utils'

export interface ChartInsightData {
  insight?: string
  takeaway?: string
}

export interface ChartWithInsightProps {
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
}

/**
 * Wraps a chart with Chart Title, AI Insight Summary, and Key Takeaway.
 */
export function ChartWithInsight({
  title,
  insight,
  takeaway,
  children,
  className,
  headerActions,
}: ChartWithInsightProps) {
  const hasInsight = Boolean(insight?.trim() || takeaway?.trim())

  return (
    <div className={cn('rounded-xl border border-border/60 bg-muted/5 p-4', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </div>
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
