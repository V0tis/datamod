'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, Trash2, Loader2, BarChart3, FileText } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { InsightCardMarkdown } from '@/components/insights/insight-card-markdown'
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

function buildStrategyMarkdown(
  opportunity: string,
  threat: string,
  actionItems: string[]
): string {
  const parts: string[] = []
  const o = opportunity.trim()
  const t = threat.trim()
  if (o) parts.push(`**기회**\n\n${o}`)
  if (t) parts.push(`**위협**\n\n${t}`)
  const items = actionItems
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    .map((a) => `- ${a.trim()}`)
  if (items.length > 0) {
    parts.push(`**실행 과제**\n\n${items.join('\n')}`)
  }
  return parts.join('\n\n')
}

function InsightSectionBadge({ label }: { label: string }) {
  return (
    <div className="mb-2">
      <span className="inline-flex rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-semibold tracking-wide text-sky-900 shadow-sm dark:bg-sky-950/55 dark:text-sky-100">
        {label}
      </span>
    </div>
  )
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
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const dateLine = formattedDate ?? formatSavedDate(item.created_at)

  const summary = (item.snapshot?.summary ?? item.snapshot?.strategicSummary?.summary ?? '').trim()
  const explanation = (item.snapshot?.qualityScore?.explanation ?? '').trim()
  const score = item.snapshot?.qualityScore?.score
  const opportunity = (item.snapshot?.strategicSummary?.opportunity ?? '').trim()
  const threat = (item.snapshot?.strategicSummary?.threat ?? '').trim()
  const actionItems = item.snapshot?.strategicSummary?.actionItems ?? []

  const importance = getImportanceFromScore(score)
  const styles = IMPORTANCE_STYLES[importance]

  const strategyMd = useMemo(
    () => buildStrategyMarkdown(opportunity, threat, actionItems),
    [opportunity, threat, actionItems]
  )

  const hasSummary = summary.length > 0
  const hasBackground = explanation.length > 0
  const hasStrategy = strategyMd.length > 0
  const hasAnyBody = hasSummary || hasBackground || hasStrategy

  const combinedCharCount = summary.length + explanation.length + strategyMd.length
  /** 긴 본문만 접기 + 더보기 (핵심 전략까지는 max-height로 기본 노출 확대) */
  const needsMoreToggle = combinedCharCount > 640

  const tagItems: { key: string; label: string }[] = [
    { key: 'kw', label: item.snapshot?.keyword ? `#${item.snapshot.keyword}` : '' },
    { key: 'mkt', label: countryLabel ? `시장 · ${countryLabel}` : '' },
    { key: 'imp', label: `중요도 · ${IMPORTANCE_LABELS[importance]}` },
  ].filter((t) => t.label.length > 0)

  if (item.snapshot?.qualityScore?.label) {
    tagItems.push({ key: 'qs', label: `신호 · ${item.snapshot.qualityScore.label}` })
  }

  const hasMemo = Boolean(item.note?.trim())

  return (
    <article
      className={cn(
        'rin-pro-card flex h-full min-h-[22rem] flex-col overflow-hidden border-l-4 transition-shadow hover:shadow-md',
        styles.border,
        selected && 'ring-2 ring-[#2AC1BC]/50 ring-offset-2 ring-offset-[#F8F9FA] dark:ring-offset-zinc-950'
      )}
    >
      <div className={cn('flex flex-1 flex-col p-4 sm:p-5', hasMemo && 'pb-0')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
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
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h3 className="break-words text-base font-bold text-[#222] dark:text-zinc-50">{item.name}</h3>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                      styles.badge
                    )}
                  >
                    {IMPORTANCE_LABELS[importance]}
                  </span>
                </div>
                <p className="text-xs tabular-nums tracking-tight text-muted-foreground">
                  <span className="font-medium text-foreground/80">{item.snapshot?.keyword ?? '—'}</span>
                  <span className="mx-1.5 text-border">|</span>
                  {countryLabel}
                  <span className="mx-1.5 text-border">|</span>
                  {dateLine}
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 w-full border-[#FF5F5F]/40 text-[#FF5F5F] hover:bg-red-50 sm:w-auto"
                  onClick={() => onDelete(item.id)}
                  disabled={deletingId === item.id}
                  aria-label="인사이트 삭제"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  삭제
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            'tracking-tight text-foreground',
            onToggleSelect ? 'mt-4 pl-0 sm:pl-[calc(1rem+2.5rem+1rem)]' : 'mt-4'
          )}
        >
          <div
            className={cn(
              'relative min-h-[16rem] text-[15px] leading-relaxed',
              !summaryExpanded && needsMoreToggle && 'max-h-[38rem] overflow-hidden'
            )}
          >
            <div className="space-y-0">
              {hasSummary && (
                <section className="mb-4">
                  <InsightSectionBadge label="요약" />
                  <InsightCardMarkdown>{summary}</InsightCardMarkdown>
                </section>
              )}

              {hasBackground && (
                <section className="mb-4">
                  <InsightSectionBadge label="배경" />
                  <InsightCardMarkdown>{explanation}</InsightCardMarkdown>
                </section>
              )}

              {hasStrategy && (
                <section className="mb-4">
                  <InsightSectionBadge label="전략" />
                  <InsightCardMarkdown>{strategyMd}</InsightCardMarkdown>
                </section>
              )}

              {!hasAnyBody && (
                <section className="mb-4">
                  <InsightSectionBadge label="요약" />
                  <p className="text-sm leading-relaxed text-muted-foreground">저장된 인사이트</p>
                </section>
              )}
            </div>

            {!summaryExpanded && needsMoreToggle && (
              <div
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent dark:from-card"
                aria-hidden
              />
            )}
          </div>

          {needsMoreToggle && (
            <button
              type="button"
              onClick={() => setSummaryExpanded((v) => !v)}
              className="mt-2 text-xs font-semibold text-[#2AC1BC] hover:underline"
            >
              {summaryExpanded ? '접기' : '더보기'}
            </button>
          )}

          {score != null && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              시장 신호 <span className="font-medium text-foreground">{score}/100</span>
              {item.snapshot?.qualityScore?.label && (
                <span className="ml-1">· {item.snapshot.qualityScore.label}</span>
              )}
            </p>
          )}

          {hasMemo && (
            <Collapsible open={open} onOpenChange={setOpen} className="mt-4">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="-ml-1 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
                  />
                  {open ? '메모 접기' : '메모 보기'}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className={cn('mt-3 rounded-lg border border-border/60 px-3 py-3', styles.bg)}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    메모
                  </p>
                  <p className="text-sm leading-relaxed text-foreground">{item.note}</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-border/70 bg-slate-50/50 px-4 py-4 dark:bg-zinc-900/40 sm:px-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tagItems.map((t) => (
            <span
              key={t.key}
              className="inline-flex max-w-full items-center rounded-md border border-[#E8EAED] bg-white px-2 py-1 text-[11px] font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              <span className="truncate">{t.label}</span>
            </span>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-10 w-full gap-2 border-[#2AC1BC]/50 font-semibold text-[#0f766e] hover:bg-[#E8FAF9] dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:w-auto"
          asChild
        >
          <Link href={resultsHref}>
            <FileText className="h-4 w-4 shrink-0" />
            원본 리포트 보기
            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </Link>
        </Button>
      </div>
    </article>
  )
}
