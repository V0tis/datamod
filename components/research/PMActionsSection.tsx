'use client'

import { useState, useCallback } from 'react'
import { RefreshCw, Loader2, Check, ChevronDown, FileDown, Copy, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type RecommendedAction = {
  title: string
  reasoning?: string
  urgency_level?: 'low' | 'medium' | 'high'
  related_risk?: string
}

export type ActionItemState = {
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  note: string
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
  loading?: boolean
  /** Enable interactive mode with checkboxes, priority, notes */
  interactive?: boolean
  /** Callback when action states change */
  onStateChange?: (states: Record<number, ActionItemState>) => void
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

export function PMActionsSection({
  actions,
  className,
  onReanalyze,
  reanalyzing = false,
  loading = false,
  interactive = false,
  onStateChange,
}: PMActionsSectionProps) {
  const [actionStates, setActionStates] = useState<Record<number, ActionItemState>>({})
  const [expandedNote, setExpandedNote] = useState<number | null>(null)

  const updateActionState = useCallback((index: number, updates: Partial<ActionItemState>) => {
    setActionStates((prev) => {
      const current = prev[index] ?? { completed: false, priority: 'medium', note: '' }
      const next = { ...current, ...updates }
      const newStates = { ...prev, [index]: next }
      onStateChange?.(newStates)
      return newStates
    })
  }, [onStateChange])

  const handleCopyAll = useCallback(() => {
    const normalized = (actions ?? [])
      .map(normalizeAction)
      .filter((x): x is RecommendedAction => x != null)
    const text = normalized
      .map((a, i) => {
        const state = actionStates[i]
        const status = state?.completed ? '[x]' : '[ ]'
        const priority = state?.priority ?? a.urgency_level ?? 'medium'
        const note = state?.note ? `\n    메모: ${state.note}` : ''
        return `${status} ${a.title} (우선순위: ${URGENCY_LABELS[priority]})${note}`
      })
      .join('\n')
    navigator.clipboard.writeText(text)
    toast.success('액션 목록을 클립보드에 복사했습니다.')
  }, [actions, actionStates])

  const handleExport = useCallback(() => {
    const normalized = (actions ?? [])
      .map(normalizeAction)
      .filter((x): x is RecommendedAction => x != null)
    const data = normalized.map((a, i) => ({
      title: a.title,
      reasoning: a.reasoning,
      originalPriority: a.urgency_level,
      relatedRisk: a.related_risk,
      ...(actionStates[i] ?? {}),
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pm-actions-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('액션 목록을 내보냈습니다.')
  }, [actions, actionStates])

  if (loading) {
    return (
      <section className={cn('space-y-3', className)}>
        <div className="h-4 w-40 rounded bg-muted/60 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-lg border border-border/60 p-3">
              <div className="flex justify-between gap-2">
                <div className="h-4 flex-1 rounded bg-muted/60 animate-pulse" />
                <div className="h-5 w-12 rounded bg-muted/40 animate-pulse shrink-0" />
              </div>
              <div className="mt-2 h-3 w-full rounded bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    )
  }
  const normalized = (actions ?? [])
    .map(normalizeAction)
    .filter((x): x is RecommendedAction => x != null)
    .sort((a, b) => {
      const ua = a.urgency_level && (a.urgency_level === 'high' || a.urgency_level === 'medium' || a.urgency_level === 'low') ? a.urgency_level : 'low'
      const ub = b.urgency_level && (b.urgency_level === 'high' || b.urgency_level === 'medium' || b.urgency_level === 'low') ? b.urgency_level : 'low'
      return URGENCY_ORDER[ua] - URGENCY_ORDER[ub]
    })
  const hasActions = normalized.length > 0
  const showSection = hasActions || onReanalyze || loading
  if (!showSection) return null

  const completedCount = Object.values(actionStates).filter((s) => s.completed).length

  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Recommended PM Actions</h3>
          {interactive && hasActions && (
            <span className="text-xs text-muted-foreground">
              {completedCount}/{normalized.length} 완료
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {interactive && hasActions && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyAll}
                className="gap-1.5 h-8"
              >
                <Copy className="h-3.5 w-3.5" />
                복사
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleExport}
                className="gap-1.5 h-8"
              >
                <FileDown className="h-3.5 w-3.5" />
                내보내기
              </Button>
            </>
          )}
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
      </div>
      <div className="space-y-2">
        {normalized.map((a, i) => {
          const state = actionStates[i] ?? { completed: false, priority: a.urgency_level ?? 'medium', note: '' }
          const urgency = state.priority
          const badgeStyle = URGENCY_STYLES[urgency]
          const badgeLabel = URGENCY_LABELS[urgency]

          return (
            <div
              key={i}
              className={cn(
                'rounded-lg border p-3 text-sm transition-all',
                urgency === 'high' && 'border-red-500/20',
                urgency === 'medium' && 'border-amber-500/20',
                urgency === 'low' && 'border-border/60',
                state.completed && 'opacity-60 bg-muted/20'
              )}
            >
              <div className="flex items-start gap-3">
                {interactive && (
                  <button
                    type="button"
                    onClick={() => updateActionState(i, { completed: !state.completed })}
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                      state.completed
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border bg-background hover:border-primary/50'
                    )}
                    aria-label={state.completed ? '완료 취소' : '완료 표시'}
                  >
                    {state.completed && <Check className="h-3 w-3" />}
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn('font-medium text-foreground', state.completed && 'line-through')}>
                      {a.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {interactive ? (
                        <div className="relative">
                          <select
                            value={state.priority}
                            onChange={(e) => updateActionState(i, { priority: e.target.value as 'low' | 'medium' | 'high' })}
                            className={cn(
                              'appearance-none rounded border px-2 py-0.5 pr-6 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50',
                              badgeStyle
                            )}
                          >
                            <option value="high">높음</option>
                            <option value="medium">보통</option>
                            <option value="low">낮음</option>
                          </select>
                          <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none opacity-50" />
                        </div>
                      ) : (
                        <span className={cn('rounded border px-1.5 py-0.5 text-xs font-medium', badgeStyle)}>
                          {badgeLabel}
                        </span>
                      )}
                      {interactive && (
                        <button
                          type="button"
                          onClick={() => setExpandedNote(expandedNote === i ? null : i)}
                          className={cn(
                            'p-1 rounded transition-colors',
                            expandedNote === i || state.note
                              ? 'text-primary bg-primary/10'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                          )}
                          aria-label="메모 추가"
                        >
                          <StickyNote className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {a.reasoning && (
                    <p className="mt-1.5 text-muted-foreground leading-relaxed">{a.reasoning}</p>
                  )}
                  {a.related_risk && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">관련 리스크:</span> {a.related_risk}
                    </p>
                  )}
                  {interactive && expandedNote === i && (
                    <div className="mt-2 pt-2 border-t border-border/60">
                      <Input
                        type="text"
                        placeholder="메모를 입력하세요..."
                        value={state.note}
                        onChange={(e) => updateActionState(i, { note: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                  {interactive && state.note && expandedNote !== i && (
                    <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                      {state.note}
                    </p>
                  )}
                </div>
              </div>
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
