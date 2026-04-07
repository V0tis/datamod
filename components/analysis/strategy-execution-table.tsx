'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { extractNextActionItems, type NextActionItem } from '@/components/research/NextActionsForPM'
import { AnalysisSourceButton } from '@/components/analysis/analysis-source-button'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'

export type RowStatus = 'todo' | 'doing' | 'done'

const STATUS_OPTIONS: { value: RowStatus; label: string }[] = [
  { value: 'todo', label: '미착수' },
  { value: 'doing', label: '진행 중' },
  { value: 'done', label: '완료' },
]

function priorityLabel(p?: NextActionItem['priority']): string {
  if (p === 'high') return 'P1 · 긴급'
  if (p === 'low') return 'P3 · 낮음'
  return 'P2 · 보통'
}

function storageKey(reportId: string | null | undefined, keyword: string): string {
  const k = keyword.trim().slice(0, 80) || 'draft'
  return `rin-strategy-status:${reportId ?? 'local'}:${k}`
}

export function StrategyExecutionTable({
  result,
  taskData,
  analysisTasks,
  loading = false,
  keyword = '',
}: {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{ step_name: string; output_data: unknown; status?: string }> | null
  loading?: boolean
  keyword?: string
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

  if ((loading || executionPending) && rows.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <SectionContentSkeleton variant="list" />
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-zinc-400">
          실행 과제·GTM 항목을 불러오는 중입니다…
        </p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        PM 액션 플랜이 비어 있습니다. 분석을 완료했는데도 비어 있으면 &ldquo;다시 분석하기&rdquo;로 재실행하거나, 인사이트 탭의 전략 요약을 참고하세요.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">전략 실행 테이블</h3>
        <AnalysisSourceButton result={result} label="출처 보기" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <th className="w-10 px-3 py-3" aria-label="펼치기" />
              <th className="px-3 py-3">우선순위</th>
              <th className="min-w-[140px] px-3 py-3">과제</th>
              <th className="min-w-[180px] px-3 py-3">실행 방법</th>
              <th className="min-w-[100px] px-3 py-3">리소스</th>
              <th className="min-w-[140px] px-3 py-3">기대 효과</th>
              <th className="w-[120px] px-3 py-3">상태</th>
              <th className="w-20 px-3 py-3 text-center">출처</th>
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
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        onClick={() => hasDetail && toggleExpand(i)}
                        disabled={!hasDetail}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 hover:bg-slate-100 disabled:cursor-default disabled:opacity-30 dark:hover:bg-zinc-800',
                          hasDetail && 'cursor-pointer'
                        )}
                        aria-expanded={isOpen}
                        aria-label={hasDetail ? '세부 내용' : '세부 없음'}
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
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200">
                        {priorityLabel(row.priority)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top font-medium text-slate-900 dark:text-zinc-100">{row.action}</td>
                    <td className="px-3 py-3 align-top text-slate-600 dark:text-zinc-300">
                      {row.how_to_execute?.trim() || (
                        <span className="text-slate-400">— 워크숍에서 확정</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-600 dark:text-zinc-300">
                      {row.estimated_effort?.trim() || <span className="text-slate-400">PM·기획 가용 시</span>}
                    </td>
                    <td className="px-3 py-3 align-top text-slate-600 dark:text-zinc-300">
                      {row.why?.trim() || <span className="text-slate-400">— 선점·수익 방어</span>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <label className="sr-only" htmlFor={`row-status-${i}`}>
                        상태
                      </label>
                      <select
                        id={`row-status-${i}`}
                        value={st}
                        onChange={(e) => setRowStatus(i, e.target.value as RowStatus)}
                        className="w-full rounded-md border border-[#E8EAED] bg-white px-2 py-1.5 text-xs font-medium text-slate-800 shadow-sm focus:border-[#2AC1BC] focus:outline-none focus:ring-1 focus:ring-[#2AC1BC]/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top text-center">
                      <AnalysisSourceButton result={result} className="justify-center" label="보기" />
                    </td>
                  </tr>
                  {isOpen && hasDetail ? (
                    <tr key={`${i}-detail`} className="border-b border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <td colSpan={8} className="px-4 py-3 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">
                        {row.how_to_execute ? (
                          <p>
                            <span className="font-semibold text-slate-700 dark:text-zinc-300">실행 상세: </span>
                            {row.how_to_execute}
                          </p>
                        ) : null}
                        {row.why ? (
                          <p className={row.how_to_execute ? 'mt-2' : ''}>
                            <span className="font-semibold text-slate-700 dark:text-zinc-300">기대 효과: </span>
                            {row.why}
                          </p>
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
    </div>
  )
}
