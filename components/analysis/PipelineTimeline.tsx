'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Clock, X, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const PIPELINE_STAGES = [
  { id: 'cache', label: '캐시 조회', icon: '💾', eta: '<1초' },
  { id: 'collect', label: '시장 데이터 수집', icon: '🌐', eta: '~10초' },
  { id: 'issues', label: '핵심 이슈 정리', icon: '📋', eta: '~8초' },
  { id: 'trend', label: '시장 흐름 분석', icon: '📈', eta: '~12초' },
  { id: 'competitor', label: '경쟁사 분석', icon: '⚔️', eta: '~12초' },
  { id: 'insight', label: '인사이트 제안', icon: '💡', eta: '~10초' },
  { id: 'strategy', label: '전략 추천', icon: '🎯', eta: '~10초' },
  { id: 'action', label: 'PM 액션 플랜', icon: '✅', eta: '~8초' },
  { id: 'risk', label: '리스크·기회 평가', icon: '⚠️', eta: '~8초' },
] as const

export type PipelineTimelineStageId = (typeof PIPELINE_STAGES)[number]['id']

export interface PipelineTimelineStageState {
  id: string
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped'
  startedAt?: number
  completedAt?: number
  errorMessage?: string
  /** 완료 단계 클릭 시 표시할 원시 출력 */
  rawOutput?: unknown
}

export interface PipelineTimelineProps {
  stages: PipelineTimelineStageState[]
  onRetry?: (stageId: string) => void
  /** 완료 배너용 */
  keyword?: string
  /** 예: KR, US */
  countryLabel?: string
}

function etaApproxSeconds(eta: string): number {
  const m = eta.match(/(\d+)\s*초/)
  if (m) return Math.max(1, parseInt(m[1], 10))
  if (eta.includes('<1')) return 1
  return 8
}

function formatRawJson(raw: unknown): string {
  if (raw == null) return '(출력 없음)'
  if (typeof raw === 'string') return raw
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return String(raw)
  }
}

function stageById(id: string) {
  return PIPELINE_STAGES.find((s) => s.id === id)
}

export function PipelineTimeline({ stages, onRetry, keyword, countryLabel }: PipelineTimelineProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [outputOpenId, setOutputOpenId] = useState<string | null>(null)
  const [detailExpanded, setDetailExpanded] = useState(true)

  const merged = useMemo(() => {
    return PIPELINE_STAGES.map((meta) => {
      const st = stages.find((s) => s.id === meta.id)
      const status = st?.status ?? 'pending'
      return {
        ...meta,
        status,
        startedAt: st?.startedAt,
        completedAt: st?.completedAt,
        errorMessage: st?.errorMessage,
        rawOutput: st?.rawOutput,
      }
    })
  }, [stages])

  const doneCount = merged.filter((s) => s.status === 'done' || s.status === 'skipped').length
  const runningIdx = merged.findIndex((s) => s.status === 'running')
  const errorIdx = merged.findIndex((s) => s.status === 'error')
  const allDone = merged.every((s) => s.status === 'done' || s.status === 'skipped')
  const anyRunning = runningIdx >= 0
  const hasError = errorIdx >= 0

  const banner = (() => {
    if (hasError) {
      const name = merged[errorIdx]?.label ?? '해당'
      return {
        tone: 'error' as const,
        text: `❌ ${name} 단계 오류 · 재시도 가능`,
      }
    }
    if (allDone) {
      const kw = keyword?.trim()
      const cc = countryLabel?.trim()
      const tail = kw && cc ? `${kw} (${cc})` : kw ? kw : cc ? `(${cc})` : ''
      return {
        tone: 'done' as const,
        text: tail ? `✅ 분석 완료 · ${tail}` : '✅ 분석 완료',
      }
    }
    if (anyRunning || !allDone) {
      return {
        tone: 'running' as const,
        text: `🔄 분석 중 · ${doneCount}/9 완료`,
      }
    }
    return { tone: 'running' as const, text: `🔄 분석 중 · ${doneCount}/9 완료` }
  })()

  const runningMeta = runningIdx >= 0 ? merged[runningIdx] : null
  const runningEtaSec = runningMeta ? etaApproxSeconds(runningMeta.eta) : 8

  useEffect(() => {
    if (anyRunning || hasError) setMobileOpen(true)
  }, [anyRunning, hasError])

  const toggleOutput = (id: string, status: string) => {
    if (status !== 'done' && status !== 'skipped') return
    setOutputOpenId((prev) => (prev === id ? null : id))
    setDetailExpanded(true)
  }

  const renderNodeInner = (s: (typeof merged)[number]) => {
    if (s.status === 'skipped') {
      return <ArrowRight className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden />
    }
    if (s.status === 'done') {
      return <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
    }
    if (s.status === 'error') {
      return <X className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
    }
    if (s.status === 'running') {
      return <span className="text-[13px] font-semibold text-white">{s.icon}</span>
    }
    return <Clock className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
  }

  const renderNodeShell = (s: (typeof merged)[number], compact: boolean) => {
    const isRunning = s.status === 'running'
    const isError = s.status === 'error'
    const clickable = s.status === 'done' || s.status === 'skipped'
    const selected = outputOpenId === s.id

    return (
      <div className={cn('flex flex-col items-center', compact ? 'min-w-0 flex-1' : 'w-full')}>
        <button
          type="button"
          disabled={!clickable}
          onClick={() => toggleOutput(s.id, s.status)}
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            s.status === 'pending' && 'border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800',
            s.status === 'skipped' && 'border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800',
            s.status === 'done' && 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-600',
            s.status === 'running' &&
              'border-blue-600 bg-blue-600 shadow-[0_0_0_4px_rgba(37,99,235,0.25)] dark:border-blue-500 dark:bg-blue-600',
            isError && 'border-red-600 bg-red-600 ring-2 ring-red-500/50 dark:border-red-500',
            clickable && 'cursor-pointer hover:opacity-90',
            !clickable && 'cursor-default',
            selected && clickable && 'ring-2 ring-sky-500/70'
          )}
          aria-label={
            clickable
              ? `${s.label} 산출물 ${selected ? '접기' : '펼치기'}`
              : `${s.label} ${s.status === 'pending' ? '대기' : s.status === 'running' ? '진행 중' : s.status === 'error' ? '오류' : ''}`
          }
        >
          {isRunning ? (
            <span
              className="pointer-events-none absolute -inset-1 rounded-full border-2 border-blue-300/70 border-t-transparent dark:border-sky-400/60 motion-safe:animate-spin"
              aria-hidden
            />
          ) : null}
          {isRunning ? <span className="relative z-[1] flex items-center justify-center">{renderNodeInner(s)}</span> : renderNodeInner(s)}
        </button>
        {isRunning ? (
          <p className="mt-1 max-w-[7.5rem] text-center text-[10px] font-medium leading-tight text-blue-700 dark:text-sky-300">
            진행 중... ~{runningEtaSec}초 남음
          </p>
        ) : s.status === 'skipped' ? (
          <p className="mt-1 text-center text-[10px] font-medium text-zinc-500 dark:text-zinc-400">캐시 히트</p>
        ) : (
          <span className="mt-1 block h-4" aria-hidden />
        )}
      </div>
    )
  }

  const renderConnector = (leftDone: boolean) => (
    <div
      className={cn(
        'mt-[15px] h-0.5 flex-1 min-w-[4px] self-start',
        leftDone ? 'bg-emerald-500 dark:bg-emerald-600' : 'bg-zinc-200 dark:bg-zinc-700'
      )}
      aria-hidden
    />
  )

  const renderLabels = (s: (typeof merged)[number], horizontal: boolean) => (
    <div className={cn('text-center', horizontal ? 'mt-2 max-w-[5.5rem] px-0.5' : 'min-w-0 flex-1 text-left')}>
      <div className="text-lg leading-none">{s.icon}</div>
      <p
        className={cn(
          'mt-1 text-[11px] font-medium leading-tight text-zinc-700 dark:text-zinc-200',
          s.status === 'running' && 'font-bold text-blue-900 dark:text-sky-100',
          s.status === 'pending' && 'text-zinc-500 dark:text-zinc-400',
          s.status === 'error' && 'font-semibold text-red-700 dark:text-red-300',
          (s.status === 'done' || s.status === 'skipped') && 'text-zinc-700 dark:text-zinc-200'
        )}
      >
        {s.label}
      </p>
      <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">예상 {s.eta}</p>
      {s.status === 'error' && onRetry ? (
        <button
          type="button"
          className="mt-1 text-[10px] font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 dark:text-red-400"
          onClick={() => onRetry(s.id)}
        >
          재시도
        </button>
      ) : null}
    </div>
  )

  const outputBlock =
    outputOpenId != null ? (
      <AnimatePresence initial={false}>
        <motion.div
          key={outputOpenId}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80 dark:border-zinc-700 dark:bg-zinc-900/80"
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-800 dark:text-zinc-100"
            onClick={() => setDetailExpanded((e) => !e)}
          >
            <span>{stageById(outputOpenId)?.label ?? outputOpenId} 단계 출력</span>
            {detailExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          {detailExpanded ? (
            <pre className="max-h-[200px] overflow-auto border-t border-zinc-200 px-3 py-2 text-[11px] leading-relaxed text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              {formatRawJson(merged.find((m) => m.id === outputOpenId)?.rawOutput)}
            </pre>
          ) : null}
        </motion.div>
      </AnimatePresence>
    ) : null

  return (
    <div className="w-full space-y-3">
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm font-medium shadow-sm',
          banner.tone === 'running' && 'bg-sky-100 text-sky-950 dark:bg-sky-950/60 dark:text-sky-50',
          banner.tone === 'done' && 'bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50',
          banner.tone === 'error' && 'bg-red-100 text-red-950 dark:bg-red-950/50 dark:text-red-50'
        )}
        role="status"
        aria-live="polite"
      >
        {banner.text}
      </div>

      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <div className="rounded-xl border border-zinc-200/90 bg-white px-2 py-4 shadow-sm sm:px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex w-full items-start justify-center">
            {merged.map((s, i) => (
              <div key={s.id} className="contents">
                {i > 0
                  ? renderConnector(
                      merged[i - 1]!.status === 'done' || merged[i - 1]!.status === 'skipped'
                    )
                  : null}
                <div className="flex min-w-0 flex-1 flex-col items-center px-0.5">
                  {renderNodeShell(s, true)}
                  {renderLabels(s, true)}
                </div>
              </div>
            ))}
          </div>
          {merged.some((s) => s.status === 'error' && onRetry) ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
              {merged.map((s) =>
                s.status === 'error' && onRetry ? (
                  <Button
                    key={`retry-${s.id}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 border-red-300 text-red-800 hover:bg-red-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950/40"
                    onClick={() => onRetry(s.id)}
                  >
                    ⟳ 이 단계만 재시도
                  </Button>
                ) : null
              )}
            </div>
          ) : null}
          {outputBlock ? <div className="mt-3">{outputBlock}</div> : null}
        </div>
      </div>

      {/* Mobile: vertical drawer */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-left text-sm font-semibold text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
          aria-expanded={mobileOpen}
        >
          <span>
            파이프라인 <span className="font-normal text-zinc-500 dark:text-zinc-400">{doneCount}/9</span>
          </span>
          {mobileOpen ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
        </button>
        <AnimatePresence initial={false}>
          {mobileOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-0 rounded-xl border border-zinc-200/90 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950">
                {merged.map((s, i) => (
                  <div key={s.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      {renderNodeShell(s, false)}
                      {i < merged.length - 1 ? (
                        <div
                          className={cn(
                            'my-0.5 w-0.5 flex-1 min-h-[12px]',
                            s.status === 'done' || s.status === 'skipped' ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-4">
                      {renderLabels(s, false)}
                      {s.status === 'error' && onRetry ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2 gap-1 border-red-300 text-xs text-red-800 dark:border-red-800 dark:text-red-200"
                          onClick={() => onRetry(s.id)}
                        >
                          ⟳ 이 단계만 재시도
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {outputBlock ? <div className="pt-1">{outputBlock}</div> : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
