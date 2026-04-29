'use client'

import { TrendingUp } from 'lucide-react'
import { SectionHeader } from '@/components/analysis/shared/SectionHeader'
import { Button } from '@/components/ui/button'
import type { OutcomeMetricItem } from '@/lib/research-priority-outcomes'

export function ExpectedOutcomesCard({
  outcomes,
  block,
  onRetry,
}: {
  outcomes: OutcomeMetricItem[]
  block: 'data' | 'loading' | 'missing'
  onRetry?: () => void
}) {
  return (
    <div className="rin-card flex h-full min-h-0 flex-col overflow-hidden font-sans">
      <div className="px-5 pb-0 pt-5 sm:px-6">
        <SectionHeader icon={TrendingUp} title="예상 성과" />
      </div>
      <div className="flex-1 px-5 pb-5 pt-2 sm:px-6">
        {block === 'data' ? (
          outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">예상 성과 지표가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {outcomes.slice(0, 6).map((outcome, i) => (
                <div
                  key={`${outcome.label}-${i}`}
                  className="rounded-xl border border-[var(--color-border)] p-4 transition-colors hover:border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border))]"
                >
                  <div className="mb-1 text-2xl font-bold tabular-nums text-[var(--color-foreground)]">{outcome.value}</div>
                  <div className="mb-2 text-xs font-semibold text-[var(--color-muted-foreground)]">{outcome.label}</div>
                  <div className="text-[11px] leading-relaxed text-[var(--color-muted-foreground)]/90">{outcome.basis}</div>
                </div>
              ))}
            </div>
          )
        ) : block === 'loading' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-muted/55" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-amber-300/90 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm   ">
            <p className="font-medium leading-relaxed">이 섹션의 데이터를 불러오지 못했습니다.</p>
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="mt-3 border-amber-700/40 bg-white hover:bg-amber-100  "
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
