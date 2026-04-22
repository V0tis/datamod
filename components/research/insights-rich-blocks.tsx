'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ChevronRight, ListOrdered, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownBody } from '@/components/ui/markdown-body'
import { Button } from '@/components/ui/button'
import {
  normalizeActionTimeline,
  type OutcomeMetricItem,
  type PriorityInsightItem,
} from '@/lib/research-priority-outcomes'

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

const prioritySquareClass: Record<0 | 1 | 2, string> = {
  0: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  1: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  2: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
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
                className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-card/50 p-4 transition-all hover:border-blue-200 hover:bg-blue-50/40 dark:border-zinc-700/80 dark:bg-zinc-900/30 dark:hover:border-blue-800 dark:hover:bg-blue-950/20 sm:gap-4"
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold',
                    prioritySquareClass[item.priority]
                  )}
                >
                  P{item.priority}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <h4 className="text-sm font-semibold leading-snug text-gray-900 dark:text-zinc-50">{item.title}</h4>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:ml-4 sm:justify-end">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
                        기간 {normalizeActionTimeline(item.timeline)}
                      </span>
                      <span className="max-w-[14rem] truncate rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-zinc-800 dark:text-zinc-400" title={item.impact}>
                        임팩트: {item.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-gray-600 dark:text-zinc-400">{item.description}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-blue-500 dark:text-zinc-600 dark:group-hover:text-blue-400" aria-hidden />
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
          outcomeMetrics.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
              예상 성과 지표가 없습니다.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {outcomeMetrics.slice(0, 3).map((metric, i) => (
                  <div
                    key={`primary-${metric.label}-${i}`}
                    className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-900/40 dark:from-blue-950/40 dark:to-indigo-950/30"
                  >
                    <div className="mb-1 text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">{metric.value}</div>
                    <div className="mb-1 text-sm font-medium text-blue-900 dark:text-blue-100">{metric.label}</div>
                    <div className="text-xs leading-snug text-blue-600/90 dark:text-blue-400/90">{metric.basis}</div>
                  </div>
                ))}
              </div>
              {outcomeMetrics.length > 3 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {outcomeMetrics.slice(3).map((metric, i) => (
                    <div
                      key={`compact-${metric.label}-${i}`}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50"
                    >
                      <div className="text-lg font-bold tabular-nums text-gray-800 dark:text-zinc-100">{metric.value}</div>
                      <div className="text-xs text-gray-600 dark:text-zinc-400">{metric.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        ) : outcomesBlock === 'loading' ? (
          <BlockSkeleton />
        ) : (
          <SectionRetryCard onRetry={onRetrySection} />
        )}
      </BlockShell>
    </div>
  )
}
