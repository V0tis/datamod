'use client'

import { RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type RecommendedAction = {
  title: string
  reasoning?: string
  urgency_level?: 'low' | 'medium' | 'high'
  related_risk?: string
}

function normalizeAction(
  a: RecommendedAction | string
): RecommendedAction | null {
  if (typeof a === 'object' && a != null && typeof (a as RecommendedAction).title === 'string') {
    return a as RecommendedAction
  }
  if (typeof a === 'string' && a.trim()) {
    return { title: a.trim(), urgency_level: 'low' }
  }
  return null
}

export interface PMActionsSectionProps {
  /** Structured actions or legacy string[] */
  actions: (RecommendedAction | string)[]
  className?: string
  /** Optional reanalyze button (shown in section header) */
  onReanalyze?: () => void
  reanalyzing?: boolean
}

const URGENCY_STYLES = {
  high: 'bg-red-500/10 text-red-600 dark:text-red-400/90 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400/90 border-amber-500/20',
  low: 'bg-muted/60 text-muted-foreground border-border/60',
} as const

const URGENCY_LABELS = {
  high: '높음',
  medium: '보통',
  low: '낮음',
} as const

const URGENCY_ORDER = { high: 0, medium: 1, low: 2 }

export function PMActionsSection({ actions, className, onReanalyze, reanalyzing = false }: PMActionsSectionProps) {
  const normalized = (actions ?? [])
    .map(normalizeAction)
    .filter((x): x is RecommendedAction => x != null)
    .sort((a, b) => {
      const ua = a.urgency_level && (a.urgency_level === 'high' || a.urgency_level === 'medium' || a.urgency_level === 'low') ? a.urgency_level : 'low'
      const ub = b.urgency_level && (b.urgency_level === 'high' || b.urgency_level === 'medium' || b.urgency_level === 'low') ? b.urgency_level : 'low'
      return URGENCY_ORDER[ua] - URGENCY_ORDER[ub]
    })
  const hasActions = normalized.length > 0
  const showSection = hasActions || onReanalyze
  if (!showSection) return null

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Recommended PM Actions</h3>
        {onReanalyze && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="gap-1.5 shrink-0"
            aria-label="재분석"
          >
            {reanalyzing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                재분석 중...
              </>
            ) : (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                재분석
              </>
            )}
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {normalized.map((a, i) => {
          const urgency = a.urgency_level && (a.urgency_level === 'low' || a.urgency_level === 'medium' || a.urgency_level === 'high')
            ? a.urgency_level
            : 'low'
          const badgeStyle = URGENCY_STYLES[urgency]
          const badgeLabel = URGENCY_LABELS[urgency]

          return (
            <div
              key={i}
              className={cn(
                'rounded-lg border p-3 text-sm',
                urgency === 'high' && 'border-red-500/20',
                urgency === 'medium' && 'border-amber-500/20',
                urgency === 'low' && 'border-border/60'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-foreground">{a.title}</span>
                <span
                  className={cn(
                    'shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium',
                    badgeStyle
                  )}
                >
                  {badgeLabel}
                </span>
              </div>
              {a.reasoning && (
                <p className="mt-1.5 text-muted-foreground leading-relaxed">{a.reasoning}</p>
              )}
              {a.related_risk && (
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium">관련 리스크:</span> {a.related_risk}
                </p>
              )}
            </div>
          )
        })}
      </div>
      {!hasActions && onReanalyze && (
        <p className="text-sm text-muted-foreground">
          추천 액션이 없습니다. 재분석 버튼을 눌러 다시 분석해 보세요.
        </p>
      )}
    </section>
  )
}
