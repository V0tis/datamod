'use client'

import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import { ChevronDown, ChevronRight, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { extractNextActionItems, type NextActionItem } from '@/components/research/NextActionsForPM'
import { AnalysisSourceButton } from '@/components/analysis/analysis-source-button'
import { SectionHeader } from '@/components/analysis/shared/SectionHeader'
import { PriorityBadge, urgencyToPLevel } from '@/components/analysis/pm-action-plan/priority-badge'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { MarkdownBody } from '@/components/ui/markdown-body'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type RowStatus = 'todo' | 'doing' | 'done'

const STATUS_OPTIONS: { value: RowStatus; label: string }[] = [
  { value: 'todo', label: '미착수' },
  { value: 'doing', label: '진행 중' },
  { value: 'done', label: '완료' },
]

function priorityLabel(p?: NextActionItem['priority']): string {
  if (p === 'high') return 'P0 · 최우선'
  if (p === 'low') return 'P2 · 낮음'
  return 'P1 · 보통'
}

const STATUS_BADGE: Record<RowStatus, string> = {
  todo: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200',
  doing: 'border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200',
  done: 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
}

/** Compact markdown for table cells (line-clamp friendly; headings inline). */
const TABLE_MD_COMPONENTS: Partial<Components> = {
  p: ({ children }) => <span className="block [&:not(:first-child)]:mt-1">{children}</span>,
  h1: ({ children }) => <span className="block font-semibold text-slate-900 dark:text-zinc-100">{children}</span>,
  h2: ({ children }) => <span className="block font-semibold text-slate-900 dark:text-zinc-100">{children}</span>,
  h3: ({ children }) => <span className="block font-semibold text-slate-900 dark:text-zinc-100">{children}</span>,
  h4: ({ children }) => <span className="block font-semibold text-slate-900 dark:text-zinc-100">{children}</span>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-0 list-inside list-disc space-y-0.5 pl-0 text-left">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-0 list-inside list-decimal space-y-0.5 pl-0 text-left">{children}</ol>
  ),
  li: ({ children }) => <li className="text-left">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} className="text-[var(--color-primary)] underline underline-offset-2" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-0.5 font-mono text-[0.85em] dark:bg-zinc-800">{children}</code>
  ),
  blockquote: ({ children }) => (
    <span className="my-0 block border-l-2 border-slate-300 pl-2 text-slate-600 dark:border-zinc-600 dark:text-zinc-400">
      {children}
    </span>
  ),
}

function ClampedTableMarkdownCell({
  raw,
  columnTitle,
  mutedPlaceholder,
  onOpenFull,
  tone = 'default',
}: {
  raw: string | null | undefined
  columnTitle: string
  mutedPlaceholder?: ReactNode
  onOpenFull: (title: string, markdown: string) => void
  tone?: 'default' | 'muted'
}) {
  const text = repairMultilingualText(raw ?? '').trim()
  if (!text) {
    return (
      <span className="text-sm text-slate-400 dark:text-zinc-500">
        {mutedPlaceholder ?? '—'}
      </span>
    )
  }
  const baseText = tone === 'muted' ? 'text-slate-600 dark:text-zinc-300' : 'font-medium text-slate-900 dark:text-zinc-100'
  return (
    <button
      type="button"
      onClick={() => onOpenFull(columnTitle, raw ?? '')}
      title="클릭하여 전체 보기"
      className={cn(
        'min-w-0 w-full max-w-full rounded-md px-0.5 py-0 text-left align-top transition-colors',
        'hover:bg-slate-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]/40 dark:hover:bg-zinc-800/70'
      )}
    >
      <div
        className={cn(
          'line-clamp-3 break-words text-sm leading-snug',
          baseText,
          '[&_ul]:my-0 [&_ol]:my-0 [&_blockquote]:my-0'
        )}
      >
        <ReactMarkdown components={TABLE_MD_COMPONENTS}>{text}</ReactMarkdown>
      </div>
    </button>
  )
}

function storageKey(reportId: string | null | undefined, keyword: string): string {
  const k = keyword.trim().slice(0, 80) || 'draft'
  return `datamod-strategy-status:${reportId ?? 'local'}:${k}`
}

export function StrategyExecutionTable({
  result,
  taskData,
  analysisTasks,
  loading = false,
  keyword = '',
  nested = false,
  variant = 'default',
}: {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{ step_name: string; output_data: unknown; status?: string }> | null
  loading?: boolean
  keyword?: string
  /** 상위 섹션에 이미 테두리가 있을 때 이중 카드 제거 */
  nested?: boolean
  /** PM 액션 플랜: 카드 헤더·배지·테이블 스타일 강화 */
  variant?: 'default' | 'consulting'
}) {
  const rows = useMemo(
    () => extractNextActionItems(result, taskData, analysisTasks, { maxItems: 15 }),
    [result, taskData, analysisTasks]
  )
  const executionTask = analysisTasks?.find((t) => t.step_name === 'execution_layer')
  const executionPending =
    !!result?.reportId &&
    rows.length === 0 &&
    (executionTask?.status === 'running' || executionTask?.status === 'pending')
  const reportId = result?.reportId ?? null
  const key = useMemo(() => storageKey(reportId, keyword), [reportId, keyword])

  const [statusByIndex, setStatusByIndex] = useState<Record<number, RowStatus>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [textDialog, setTextDialog] = useState<{ title: string; markdown: string } | null>(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, string>
      const next: Record<number, RowStatus> = {}
      for (const [k, v] of Object.entries(parsed)) {
        const i = Number(k)
        if (!Number.isFinite(i)) continue
        if (v === 'todo' || v === 'doing' || v === 'done') next[i] = v
      }
      setStatusByIndex(next)
    } catch {
      /* ignore */
    }
  }, [key])

  const persist = useCallback(
    (map: Record<number, RowStatus>) => {
      try {
        const flat: Record<string, string> = {}
        for (const [k, v] of Object.entries(map)) flat[k] = v
        sessionStorage.setItem(key, JSON.stringify(flat))
      } catch {
        /* ignore */
      }
    },
    [key]
  )

  const openTextDialog = useCallback((title: string, markdown: string) => {
    setTextDialog({ title, markdown })
  }, [])

  const setRowStatus = (index: number, status: RowStatus) => {
    setStatusByIndex((prev) => {
      const next = { ...prev, [index]: status }
      persist(next)
      return next
    })
  }

  const toggleExpand = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const consulting = variant === 'consulting'
  const shell =
    consulting
      ? 'rounded-none border-0 bg-transparent shadow-none dark:bg-transparent'
      : nested
        ? 'rounded-md border border-slate-200/90 bg-transparent dark:border-zinc-700'
        : 'rounded-xl border border-[#E5E7EB] bg-white dark:border-zinc-700 dark:bg-zinc-900'

  const theadRowClass = consulting
    ? 'border-b border-[var(--color-border)] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-500'
    : 'border-b border-slate-100 bg-slate-50/95 text-xs font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-400'

  if ((loading || executionPending) && rows.length === 0) {
    const loadingInner = (
      <>
        <SectionContentSkeleton variant="list" />
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
          실행 과제·GTM 항목을 불러오는 중입니다…
        </p>
      </>
    )
    if (consulting) {
      return (
        <div className="rin-card overflow-hidden p-0">
          <div className="px-6 pt-6">
            <SectionHeader
              icon={Table2}
              title="전략 실행 테이블"
              rightSlot={<AnalysisSourceButton result={result} label="출처 보기" />}
            />
          </div>
          <div className="border-t border-border px-5 py-5">{loadingInner}</div>
        </div>
      )
    }
    return <div className={cn(shell, 'p-5')}>{loadingInner}</div>
  }

  if (rows.length === 0) {
    const emptyBody = (
      <div
        className={cn(
          consulting
            ? 'border-t border-border px-6 py-10 text-center text-sm text-slate-500 dark:text-zinc-400'
            : nested
              ? 'border border-dashed border-slate-200/90 px-5 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400'
              : 'rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] px-6 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
        )}
      >
        PM 액션 플랜이 비어 있습니다. 분석을 완료했는데도 비어 있으면 &ldquo;다시 분석하기&rdquo;로 재실행하거나, 인사이트 탭의 전략 요약을 참고하세요.
      </div>
    )
    if (consulting) {
      return (
        <div className="rin-card overflow-hidden p-0">
          <div className="px-6 pt-6">
            <SectionHeader
              icon={Table2}
              title="전략 실행 테이블"
              rightSlot={<AnalysisSourceButton result={result} label="출처 보기" />}
            />
          </div>
          {emptyBody}
        </div>
      )
    }
    return emptyBody
  }

  const tableBlock = (
    <div className={cn('max-w-full min-w-0 overflow-hidden', shell)}>
      {!consulting ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-zinc-800 sm:px-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">전략 실행 테이블</h3>
          <AnalysisSourceButton result={result} label="출처 보기" />
        </div>
      ) : null}
      <div className="rin-table-scroll max-h-[min(70vh,720px)] overflow-auto rounded-b-md">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-sm md:min-w-[780px]">
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 112 }} />
            <col />
            <col style={{ width: 200 }} />
            <col />
            <col style={{ width: 132 }} />
            <col style={{ width: 88 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
            <tr
              className={cn(
                theadRowClass,
                !consulting && 'backdrop-blur-sm'
              )}
            >
              <th className="px-2 py-3" aria-label="펼치기" />
              <th className="whitespace-nowrap px-2 py-3">우선순위</th>
              <th className="min-w-0 px-3 py-3">과제</th>
              <th className="hidden min-w-0 px-3 py-3 md:table-cell">실행 방법</th>
              <th className="min-w-0 px-3 py-3">기대 효과</th>
              <th className="whitespace-nowrap px-2 py-3">상태</th>
              <th className="px-2 py-3 text-center">출처</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const st = statusByIndex[i] ?? 'todo'
              const isOpen = expanded[i]
              const hasDetail = !!(row.why || row.how_to_execute)
              return (
                <Fragment key={i}>
                  <tr
                    className={cn(
                      'border-b border-slate-100 transition-colors dark:border-zinc-800',
                      consulting
                        ? 'hover:bg-blue-50/30 dark:hover:bg-blue-950/15'
                        : 'hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
                      hasDetail && 'cursor-pointer'
                    )}
                    onClick={(e) => {
                      if (!hasDetail) return
                      const t = e.target as HTMLElement
                      if (t.closest('button, select, a, option')) return
                      toggleExpand(i)
                    }}
                  >
                    <td className="px-2 py-3 align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (hasDetail) toggleExpand(i)
                        }}
                        disabled={!hasDetail}
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:hover:bg-zinc-800',
                          hasDetail && 'cursor-pointer'
                        )}
                        aria-expanded={isOpen}
                        aria-label={hasDetail ? '세부 내용 펼치기' : '세부 없음'}
                      >
                        {hasDetail ? (
                          isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : (
                          <span className="h-1 w-1 rounded-full bg-slate-300" />
                        )}
                      </button>
                    </td>
                    <td className="px-2 py-3 align-top">
                      {consulting ? (
                        <PriorityBadge level={urgencyToPLevel(row.priority)} size="sm" />
                      ) : (
                        <span className="inline-flex whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200">
                          {priorityLabel(row.priority)}
                        </span>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-3 align-top">
                      <ClampedTableMarkdownCell
                        raw={row.action}
                        columnTitle="과제"
                        onOpenFull={openTextDialog}
                      />
                    </td>
                    <td className="hidden min-w-0 px-3 py-3 align-top md:table-cell">
                      <ClampedTableMarkdownCell
                        raw={row.how_to_execute}
                        columnTitle="실행 방법"
                        mutedPlaceholder={<span>— 워크숍에서 확정</span>}
                        onOpenFull={openTextDialog}
                        tone="muted"
                      />
                    </td>
                    <td className="min-w-0 px-3 py-3 align-top">
                      <ClampedTableMarkdownCell
                        raw={row.why}
                        columnTitle="기대 효과"
                        mutedPlaceholder={<span>— 선점·수익 방어</span>}
                        onOpenFull={openTextDialog}
                        tone="muted"
                      />
                    </td>
                    <td className="w-[132px] px-2 py-3 align-top">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={cn(
                            'inline-flex w-fit rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                            STATUS_BADGE[st]
                          )}
                        >
                          {STATUS_OPTIONS.find((o) => o.value === st)?.label ?? '미착수'}
                        </span>
                        <label className="sr-only" htmlFor={`row-status-${i}`}>
                          상태 변경
                        </label>
                        <select
                          id={`row-status-${i}`}
                          value={st}
                          onChange={(e) => setRowStatus(i, e.target.value as RowStatus)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full min-w-0 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] px-1.5 py-1 text-[11px] font-medium text-slate-800 shadow-sm focus:border-[var(--color-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-2 py-3 align-top text-center">
                      <AnalysisSourceButton result={result} className="justify-center" label="전략 보기" />
                    </td>
                  </tr>
                  {isOpen && hasDetail ? (
                    <tr key={`${i}-detail`} className="border-b border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <td colSpan={7} className="px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                        {row.how_to_execute ? (
                          <div>
                            <p className="font-semibold text-slate-700 dark:text-zinc-300">실행 상세</p>
                            <div className="mt-1 text-foreground">
                              <MarkdownBody className="!text-xs !leading-relaxed">
                                {repairMultilingualText(row.how_to_execute)}
                              </MarkdownBody>
                            </div>
                          </div>
                        ) : null}
                        {row.why ? (
                          <div className={row.how_to_execute ? 'mt-3' : ''}>
                            <p className="font-semibold text-slate-700 dark:text-zinc-300">기대 효과</p>
                            <div className="mt-1 text-foreground">
                              <MarkdownBody className="!text-xs !leading-relaxed">
                                {repairMultilingualText(row.why)}
                              </MarkdownBody>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={textDialog != null} onOpenChange={(open) => !open && setTextDialog(null)}>
        <DialogContent className="max-h-[min(85vh,720px)] gap-0 p-0">
          <DialogHeader className="px-4 pt-4 sm:px-5">
            <DialogTitle>{textDialog?.title ?? '내용'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[min(60vh,520px)] overflow-y-auto px-4 pb-4 sm:px-5">
            {textDialog ? (
              <MarkdownBody className="text-sm">{repairMultilingualText(textDialog.markdown)}</MarkdownBody>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  return consulting ? (
    <div className="rin-card overflow-hidden p-0">
      <div className="px-6 pt-6">
        <SectionHeader
          icon={Table2}
          title="전략 실행 테이블"
          rightSlot={<AnalysisSourceButton result={result} label="출처 보기" />}
        />
      </div>
      <div className="border-t border-border">{tableBlock}</div>
    </div>
  ) : (
    tableBlock
  )
}
