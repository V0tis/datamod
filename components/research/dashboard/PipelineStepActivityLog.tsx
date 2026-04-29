'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ActivityLogMarkdown } from '@/components/research/activity-log-markdown'
import { streamTaskToStageIndex } from '@/lib/analysis/pipeline-activity-step'
import { cn } from '@/lib/utils'

export type ActivityRow = {
  ts: number
  message: string
  kind?: 'error'
  type?: 'error'
  stepId?: string
}

type StageStatus = 'pending' | 'running' | 'completed' | 'failed'

/** 단계별 로그만 필터 (stepId 없음 → 0단계에만 표시) */
export function filterLogsForStage(all: ActivityRow[], stageIndex: number): ActivityRow[] {
  return all.filter((l) => {
    if (l.stepId === '__global__') return false
    if (!l.stepId) return stageIndex === 0
    const idx = streamTaskToStageIndex(l.stepId)
    return idx === stageIndex
  })
}

/** 한 줄 미리보기(마크다운 기호 제거, hydration 안전하게 div 밖에서도 사용) */
export function plainActivityPreview(message: string, maxLen = 140): string {
  const one = message.replace(/\r\n/g, '\n').split('\n')[0] ?? ''
  const stripped = one.replace(/\*{1,2}/g, '').replace(/`/g, '').trim()
  return stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…` : stripped
}

export function GlobalPipelineActivityStrip({
  logs,
  stripRef,
}: {
  logs: ActivityRow[]
  stripRef?: RefObject<HTMLDivElement | null>
}) {
  const global = logs.filter((l) => l.stepId === '__global__')
  if (global.length === 0) return null
  return (
    <div
      ref={stripRef}
      className="mb-4 rounded-lg border border-slate-200/90 bg-slate-50/90 px-3 py-2  "
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 ">공통 알림</div>
      <div className="mt-1 space-y-1.5">
        {global.slice(-6).map((row, i) => (
          <div
            key={`${row.ts}-${i}`}
            className={cn('text-[11px] leading-snug text-slate-600 ', row.kind === 'error' && 'text-red-600 ')}
          >
            <ActivityLogMarkdown source={row.message} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function PipelineStepActivityLog({
  logs,
  status,
  previewCount = 3,
  compact = true,
}: {
  logs: ActivityRow[]
  status: StageStatus
  /** 진행 중: 최근 항목 개수 */
  previewCount?: number
  /** 좁은 간격·작은 타이포 (라이브 로그 상시 노출) */
  compact?: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(status === 'running')

  useEffect(() => {
    if (status === 'running') setExpanded(true)
  }, [status])

  const entries = useMemo(() => {
    if (logs.length === 0) return []
    if (status === 'running') return logs.slice(-previewCount)
    if (status === 'completed' || status === 'failed') {
      if (expanded) return logs
      return logs.slice(-1)
    }
    return logs
  }, [logs, status, expanded, previewCount])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const stick =
      status === 'running' ||
      ((status === 'completed' || status === 'failed') && expanded && logs.length > 0)
    if (!stick) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [logs, status, expanded])

  if (logs.length === 0) return null

  const canToggle = (status === 'completed' || status === 'failed') && logs.length > 1

  return (
    <div className={cn('mt-2', compact && 'border-t border-slate-100/90 pt-2 ')}>
      {canToggle && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mb-1 flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800  "
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>활동 로그 {logs.length}건{expanded ? ' · 전체' : ' · 요약'}</span>
        </button>
      )}
      <div
        ref={scrollRef}
        className={cn(
          compact
            ? 'rounded-md bg-slate-50/80 px-2 py-1.5 '
            : 'rounded-md border border-slate-100 bg-white/90 px-2.5 py-2  ',
          status === 'running' && 'max-h-24 overflow-y-auto scroll-smooth',
          (status === 'completed' || status === 'failed') && expanded && 'max-h-40 overflow-y-auto scroll-smooth',
          (status === 'completed' || status === 'failed') && !expanded && 'max-h-14 overflow-hidden'
        )}
      >
        <div className={cn('space-y-1.5', compact && 'space-y-1')}>
          {entries.map((row, i) => (
            <div
              key={`${row.ts}-${i}`}
              className={cn(
                'border-b border-slate-100/80 pb-1.5 last:border-0 last:pb-0 ',
                row.kind === 'error' && 'rounded bg-red-50/90 px-1 py-0.5 '
              )}
            >
              <div className="text-[10px] tabular-nums text-slate-400 ">
                {new Date(row.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className={cn(compact ? 'text-[11px]' : 'text-xs', row.kind === 'error' && 'text-red-700 ')}>
                <ActivityLogMarkdown source={row.message} className={compact ? 'text-[11px] text-slate-600 ' : undefined} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
