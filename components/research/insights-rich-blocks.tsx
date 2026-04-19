'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ListOrdered, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownBody } from '@/components/ui/markdown-body'
import { Button } from '@/components/ui/button'
import type { OutcomeMetricItem, PriorityInsightItem } from '@/lib/research-priority-outcomes'

export type InsightsRichBlocksProps = {
  /** 전략적 리스크 — 문자열 또는 마크다운 */
  strategicRisks: string[]
  priorityItems: PriorityInsightItem[]
  outcomeMetrics: OutcomeMetricItem[]
  /** 우선순위 / 예상 성과 블록 UI 상태 */
  priorityBlock: 'data' | 'loading' | 'missing'
  outcomesBlock: 'data' | 'loading' | 'missing'
  /** 실행 단계(execution_layer) 재시도 — 섹션별 동일 동작 */
  onRetrySection?: () => void
  className?: string
}

function BlockShell({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('py-6', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function SectionRetryCard({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-amber-300/90 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/35 dark:text-amber-50">
      <p className="flex items-start gap-2 font-medium leading-relaxed">
        <span className="shrink-0" aria-hidden>
          ⚠️
        </span>
        <span>이 섹션의 데이터를 불러오지 못했습니다.</span>
      </p>
      {onRetry ? (
        <Button type="button" size="sm" variant="outline" className="mt-3 border-amber-700/40 bg-white hover:bg-amber-100 dark:bg-zinc-900 dark:hover:bg-zinc-800" onClick={onRetry}>
          이 섹션만 재분석
        </Button>
      ) : null}
    </div>
  )
}

function BlockSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true">
      <div className="h-10 rounded-md bg-muted/50" />
      <div className="h-10 rounded-md bg-muted/40" />
    </div>
  )
}

const priorityBadgeClass: Record<0 | 1 | 2, string> = {
  0: 'border-rose-300/80 bg-rose-100 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100',
  1: 'border-amber-300/80 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
  2: 'border-border bg-muted text-muted-foreground dark:bg-zinc-800 dark:text-zinc-200',
}

/**
 * 핵심 인사이트 하단: 전략적 리스크 / 우선순위 / 예상 성과
 */
export function InsightsRichBlocks({
  strategicRisks,
  priorityItems,
  outcomeMetrics,
  priorityBlock,
  outcomesBlock,
  onRetrySection,
  className,
}: InsightsRichBlocksProps) {
  const hasRisks = strategicRisks.some((s) => s.trim().length > 0)

  return (
    <div className={cn('border-t border-border/50 font-[family-name:var(--font-sans)]', className)}>
      <BlockShell icon={AlertTriangle} title="전략적 리스크" className="border-b border-border/40">
        {hasRisks ? (
          <ul className="space-y-2 text-sm text-foreground">
            {strategicRisks.filter(Boolean).map((line, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/90" aria-hidden />
                <div className="min-w-0 flex-1">
                  <MarkdownBody className="!prose-sm max-w-none leading-relaxed">{line}</MarkdownBody>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            리스크 시그널이 수집되면 이 영역에 표시됩니다.
          </div>
        )}
      </BlockShell>

      <BlockShell icon={ListOrdered} title="우선순위 제안" className="border-b border-border/40">
        {priorityBlock === 'data' ? (
          <div className="space-y-3">
            {priorityItems.map((item, i) => (
              <div
                key={`${item.title}-${i}`}
                className="priority-card rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/40"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    className={cn(
                      'badge inline-flex shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide',
                      priorityBadgeClass[item.priority]
                    )}
                  >
                    P{item.priority}
                  </span>
                  <h4 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">{item.title}</h4>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                <div className="meta mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>예상 기간: {item.timeline}</span>
                  <span>임팩트: {item.impact}</span>
                </div>
              </div>
            ))}
          </div>
        ) : priorityBlock === 'loading' ? (
          <BlockSkeleton />
        ) : (
          <SectionRetryCard onRetry={onRetrySection} />
        )}
      </BlockShell>

      <BlockShell icon={TrendingUp} title="예상 성과">
        {outcomesBlock === 'data' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {outcomeMetrics.map((metric, i) => (
              <div
                key={`${metric.label}-${i}`}
                className="metric-card rounded-xl border border-border/60 bg-muted/10 px-3 py-3 dark:border-zinc-700/70 dark:bg-zinc-900/30"
              >
                <div className="metric-value text-lg font-semibold tabular-nums tracking-tight text-foreground">
                  {metric.value}
                </div>
                <div className="metric-label mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {metric.label}
                </div>
                <div className="metric-basis mt-2 text-[13px] leading-snug text-muted-foreground">{metric.basis}</div>
              </div>
            ))}
          </div>
        ) : outcomesBlock === 'loading' ? (
          <BlockSkeleton />
        ) : (
          <SectionRetryCard onRetry={onRetrySection} />
        )}
      </BlockShell>
    </div>
  )
}
