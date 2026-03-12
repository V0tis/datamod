'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { textToBullets } from '@/lib/text-to-bullets'
import { cn } from '@/lib/utils'
import { motionConfig } from '@/lib/motion-config'
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
    badge: 'bg-primary/15 text-primary border-primary/30',
    border: 'border-l-primary',
    bg: 'bg-primary/5',
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
}

/**
 * Insight card with title, short summary, detailed explanation (expandable),
 * importance level, bullet points, and highlight colors.
 */
export function InsightCard({ item, resultsHref, countryLabel, onDelete, deletingId }: InsightCardProps) {
  const [open, setOpen] = useState(false)

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
    <motion.article
      layout={false}
      whileHover={{
        y: motionConfig.cardHover.y,
        transition: motionConfig.cardHover.transition,
      }}
      className={cn(
        'rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm',
        'hover:shadow-md border-l-4',
        styles.border
      )}
    >
      <div className={cn('p-4 sm:p-5', hasDetail && 'pb-0')}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-foreground break-words">{item.name}</h3>
                <span
                  className={cn(
                    'text-[11px] font-medium px-2 py-0.5 rounded border shrink-0',
                    styles.badge
                  )}
                >
                  {IMPORTANCE_LABELS[importance]}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {item.snapshot?.keyword ?? '—'} · {countryLabel}
                <span className="ml-2">· <TimeAgo isoString={item.created_at} /></span>
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                <Link href={resultsHref} className="gap-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                  결과
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item.id)}
                disabled={deletingId === item.id}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
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
    </motion.article>
  )
}
