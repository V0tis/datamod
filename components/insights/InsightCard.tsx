'use client'

import { useState } from 'react'
import { ChevronDown, ExternalLink, Trash2, Loader2, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { textToBullets } from '@/lib/text-to-bullets'
import { cn } from '@/lib/utils'
import type { SavedInsight } from '@/lib/insights-types'

export type ImportanceLevel = 'low' | 'medium' | 'high'

function getImportanceFromScore(score: number | undefined): ImportanceLevel {
  if (score == null || typeof score !== 'number') return 'medium'
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

const IMPORTANCE_STYLES: Record<ImportanceLevel, { badge: string; border: string; bg: string }> = {
  high: {
    badge: 'bg-[#E8FAF9] text-[#0f766e] border-[#2AC1BC]/40',
    border: 'border-l-[#2AC1BC]',
    bg: 'bg-[#E8FAF9]/40',
  },
  medium: {
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    border: 'border-l-amber-500/60',
    bg: 'bg-amber-500/5',
  },
  low: {
    badge: 'bg-muted text-muted-foreground border-border/60',
    border: 'border-l-muted-foreground/40',
    bg: 'bg-muted/30',
  },
}

const IMPORTANCE_LABELS: Record<ImportanceLevel, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}

export interface InsightCardProps {
  item: SavedInsight
  resultsHref: string
  countryLabel: string
  onDelete: (id: string) => void
  deletingId: string | null
  selected?: boolean
  onToggleSelect?: (id: string) => void
  formattedDate?: string
}

/**
 * Insight card with title, short summary, detailed explanation (expandable),
 * importance level, bullet points, and highlight colors.
 */
function formatSavedDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function InsightCard({
  item,
  resultsHref,
  countryLabel,
  onDelete,
  deletingId,
  selected = false,
  onToggleSelect,
  formattedDate,
}: InsightCardProps) {
  const [open, setOpen] = useState(false)
  const dateLine = formattedDate ?? formatSavedDate(item.created_at)

  const summary = (item.snapshot?.summary ?? item.snapshot?.strategicSummary?.summary ?? '').trim()
  const explanation = (item.snapshot?.qualityScore?.explanation ?? '').trim()
  const score = item.snapshot?.qualityScore?.score
  const opportunity = (item.snapshot?.strategicSummary?.opportunity ?? '').trim()
  const threat = (item.snapshot?.strategicSummary?.threat ?? '').trim()
  const actionItems = item.snapshot?.strategicSummary?.actionItems ?? []

  const importance = getImportanceFromScore(score)
  const styles = IMPORTANCE_STYLES[importance]

  const shortSummary = summary
    ? summary.slice(0, 120) + (summary.length > 120 ? '…' : '')
    : explanation
      ? explanation.slice(0, 120) + (explanation.length > 120 ? '…' : '')
      : opportunity || threat || '저장된 인사이트'

  const detailBullets: string[] = []
  const addUnique = (items: string[]) => {
    items.forEach((t) => {
      const trimmed = t.trim()
      if (trimmed && !detailBullets.some((b) => b.slice(0, 40) === trimmed.slice(0, 40))) {
        detailBullets.push(trimmed)
      }
    })
  }
  if (summary) addUnique(textToBullets(summary, 5))
  if (explanation) addUnique(textToBullets(explanation, 4))
  actionItems.forEach((a) => typeof a === 'string' && a.trim() && addUnique([a.trim()]))
  if (opportunity) addUnique([`기회: ${opportunity}`])
  if (threat) addUnique([`위협: ${threat}`])

  const hasDetail = detailBullets.length > 0 || item.note

  return (
    <article
      className={cn(
        'rin-pro-card overflow-hidden border-l-4 transition-shadow hover:shadow-md',
        styles.border,
        selected && 'ring-2 ring-[#2AC1BC]/50 ring-offset-2 ring-offset-[#F8F9FA]'
      )}
    >
      <div className={cn('p-4 sm:p-5', hasDetail && 'pb-0')}>
        <div className="flex gap-3 sm:gap-4">
          {onToggleSelect && (
            <label className="flex shrink-0 cursor-pointer items-start pt-1">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(item.id)}
                className="mt-0.5 h-4 w-4 rounded border-[#E8EAED] text-[#2AC1BC] focus:ring-[#2AC1BC]"
                aria-label={`${item.name} 선택`}
              />
            </label>
          )}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8FAF9] text-[#2AC1BC]"
            title="분석 결과에서 저장됨"
          >
            <BarChart3 className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-[#222] break-words">{item.name}</h3>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0',
                      styles.badge
                    )}
                  >
                    {IMPORTANCE_LABELS[importance]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  <span className="font-medium text-foreground/80">{item.snapshot?.keyword ?? '—'}</span>
                  <span className="mx-1.5 text-border">|</span>
                  {countryLabel}
                  <span className="mx-1.5 text-border">|</span>
                  {dateLine}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  className="h-9 rounded-lg bg-[#2AC1BC] font-semibold text-white hover:bg-[#26b0ab] gap-1"
                  asChild
                >
                  <Link href={resultsHref}>
                    <ExternalLink className="h-4 w-4" />
                    분석으로 이동
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 text-[#FF5F5F] border-[#FF5F5F]/40 hover:bg-red-50"
                  onClick={() => onDelete(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="인사이트 삭제"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className={cn('space-y-3', onToggleSelect ? 'mt-4 pl-0 sm:pl-[calc(1rem+2.5rem+1rem)]' : 'mt-3')}>

          <p className="text-sm text-foreground/90 leading-relaxed">{shortSummary}</p>

          {score != null && (
            <p className="text-xs text-muted-foreground">
              시장 신호 <span className="font-medium text-foreground">{score}/100</span>
              {item.snapshot?.qualityScore?.label && (
                <span className="ml-1">· {item.snapshot.qualityScore.label}</span>
              )}
            </p>
          )}

          {hasDetail && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline -ml-1"
                >
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 transition-transform duration-200', open && 'rotate-180')}
                  />
                  {open ? '접기' : '상세 보기'}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div
                  className={cn(
                    'mt-4 pt-4 border-t border-border/60 rounded-lg px-4 py-3 space-y-3',
                    styles.bg
                  )}
                >
                  {detailBullets.length > 0 && (
                    <ul className="space-y-2 list-none pl-0">
                      {detailBullets.slice(0, 8).map((bullet, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <span className="text-primary shrink-0">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.note && (
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        메모
                      </p>
                      <p className="text-sm text-foreground">{item.note}</p>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </article>
  )
}
