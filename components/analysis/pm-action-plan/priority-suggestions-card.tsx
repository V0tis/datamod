'use client'

import { ListOrdered } from 'lucide-react'
import { SectionHeader } from '@/components/analysis/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PriorityInsightItem } from '@/lib/research-priority-outcomes'
import { normalizeActionTimeline } from '@/lib/research-priority-outcomes'
import { PriorityBadge } from './priority-badge'

function impactFromPriority(p: 0 | 1 | 2): 'high' | 'mid' | 'low' {
  if (p === 0) return 'high'
  if (p === 1) return 'mid'
  return 'low'
}

function impactChipClass(impact: 'high' | 'mid' | 'low'): string {
  if (impact === 'high') {
    return 'bg-[color-mix(in_srgb,var(--color-success)_16%,var(--color-background))] text-[var(--color-success)]'
  }
  if (impact === 'mid') {
    return 'bg-[color-mix(in_srgb,var(--color-chart-3)_14%,var(--color-background))] text-[var(--color-chart-3)]'
  }
  return 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
}

export function PrioritySuggestionsCard({
  items,
  block,
  onRetry,
}: {
  items: PriorityInsightItem[]
  block: 'data' | 'loading' | 'missing'
  onRetry?: () => void
}) {
  return (
    <div className="rin-card flex h-full min-h-0 flex-col overflow-hidden font-sans">
      <div className="px-5 pb-0 pt-5 sm:px-6">
        <SectionHeader icon={ListOrdered} title="우선순위 제안" />
      </div>
      <div className="flex-1 space-y-2 px-5 pb-5 pt-2 sm:px-6">
        {block === 'data' ? (
          items.length === 0 ? (
            <p className="text-sm text-muted-foreground">우선순위 과제가 없습니다.</p>
          ) : (
            items.map((item, i) => {
              const impact = impactFromPriority(item.priority)
              return (
                <div
                  key={`${item.title}-${i}`}
                  className={cn(
                    'group flex cursor-default items-center gap-3 rounded-lg border border-transparent p-3.5 transition-all',
                    'hover:border-[var(--color-border)] hover:bg-[color-mix(in_srgb,var(--color-muted)_50%,var(--color-background))]'
                  )}
                >
                  <PriorityBadge level={item.priority} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-foreground)]">{item.title}</span>
                    </div>
                    <p className="line-clamp-1 text-xs text-gray-500 dark:text-zinc-400">{item.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {item.timeline ? (
                      <span className="rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                        {normalizeActionTimeline(item.timeline)}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-medium',
                        impactChipClass(impact)
                      )}
                    >
                      임팩트 {impact === 'high' ? '높음' : impact === 'mid' ? '중간' : '낮음'}
                    </span>
                  </div>
                </div>
              )
            })
          )
        ) : block === 'loading' ? (
          <div className="space-y-2 animate-pulse" aria-busy="true">
            <div className="h-14 rounded-lg bg-muted/60" />
            <div className="h-14 rounded-lg bg-muted/50" />
            <div className="h-14 rounded-lg bg-muted/40" />
          </div>
        ) : (
          <div className="rounded-lg border border-amber-300/90 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm dark:border-amber-800/80 dark:bg-amber-950/35 dark:text-amber-50">
            <p className="font-medium leading-relaxed">이 섹션의 데이터를 불러오지 못했습니다.</p>
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3 border-amber-700/40 bg-white hover:bg-amber-100 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                onClick={onRetry}
              >
                이 섹션만 재분석
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
