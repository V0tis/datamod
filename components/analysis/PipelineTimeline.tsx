'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  FileText,
  Globe,
  Lightbulb,
  Swords,
  Target,
  TrendingUp,
  CheckSquare,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const STAGE_ICONS: readonly LucideIcon[] = [
  Database,
  Globe,
  FileText,
  TrendingUp,
  Swords,
  Lightbulb,
  Target,
  CheckSquare,
  AlertTriangle,
]

export const PIPELINE_STAGES = [
  { id: 'cache', label: '캐시 조회', eta: '<1초' },
  { id: 'collect', label: '시장 데이터 수집', eta: '~10초' },
  { id: 'issues', label: '핵심 이슈 정리', eta: '~8초' },
  { id: 'trend', label: '시장 흐름 분석', eta: '~12초' },
  { id: 'competitor', label: '경쟁사 분석', eta: '~12초' },
  { id: 'insight', label: '인사이트 제안', eta: '~10초' },
  { id: 'strategy', label: '전략 추천', eta: '~10초' },
  { id: 'action', label: 'PM 액션 플랜', eta: '~8초' },
  { id: 'risk', label: '리스크·기회 평가', eta: '~8초' },
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

function stageDurationSec(startedAt?: number, completedAt?: number): number | null {
  if (startedAt == null || completedAt == null) return null
  const sec = Math.max(0, Math.round((completedAt - startedAt) / 1000))
  return Number.isFinite(sec) ? sec : null
}

type MergedStage = (typeof PIPELINE_STAGES)[number] & PipelineTimelineStageState & { icon: LucideIcon }

export function PipelineTimeline({ stages, onRetry, keyword, countryLabel }: PipelineTimelineProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [outputOpenId, setOutputOpenId] = useState<string | null>(null)
  const [detailExpanded, setDetailExpanded] = useState(true)

  const merged = useMemo((): MergedStage[] => {
    return PIPELINE_STAGES.map((meta, idx) => {
      const st = stages.find((s) => s.id === meta.id)
      const status = st?.status ?? 'pending'
      return {
        ...meta,
        icon: STAGE_ICONS[idx]!,
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

  const totalAnalysisSec = useMemo(() => {
    if (!allDone) return null
    const starts = merged.map((s) => s.startedAt).filter((n): n is number => n != null)
    const ends = merged.map((s) => s.completedAt).filter((n): n is number => n != null)
    if (!starts.length || !ends.length) return null
    return Math.max(0, Math.round((Math.max(...ends) - Math.min(...starts)) / 1000))
  }, [allDone, merged])

  const runningMeta = runningIdx >= 0 ? merged[runningIdx] : null
  const runningEtaSec = runningMeta ? etaApproxSeconds(runningMeta.eta) : 8
  const nextStageName = runningMeta?.label ?? ''

  useEffect(() => {
    if (anyRunning || hasError) setMobileOpen(true)
  }, [anyRunning, hasError])

  const toggleOutput = (id: string, status: string) => {
    if (status !== 'done' && status !== 'skipped') return
    setOutputOpenId((prev) => (prev === id ? null : id))
    setDetailExpanded(true)
  }

  const renderStepCircle = (s: MergedStage) => {
    const Icon = s.icon
    const clickable = s.status === 'done' || s.status === 'skipped'

    if (s.status === 'skipped') {
      return (
        <div
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white  ',
            clickable && 'cursor-pointer hover:opacity-90'
          )}
        >
          <ArrowRight className="h-3.5 w-3.5 text-gray-400 " aria-hidden />
        </div>
      )
    }

    if (s.status === 'done') {
      return (
        <div
          className={cn(
            'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500 ',
            clickable && 'cursor-pointer hover:opacity-90'
          )}
        >
          <Check className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden />
        </div>
      )
    }

    if (s.status === 'error') {
      return (
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500 ">
          <X className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden />
        </div>
      )
    }

    if (s.status === 'running') {
      return (
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-50 motion-safe:animate-ping " aria-hidden />
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50  ">
            <Icon className="h-3.5 w-3.5 text-blue-500 " aria-hidden />
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white  ">
        <Icon className="h-3.5 w-3.5 text-gray-300 " aria-hidden />
      </div>
    )
  }

  const renderNodeShell = (s: MergedStage, compact: boolean) => {
    const clickable = s.status === 'done' || s.status === 'skipped'
    const selected = outputOpenId === s.id
    const dur = stageDurationSec(s.startedAt, s.completedAt)

    return (
      <div className={cn('flex flex-col items-center', compact ? 'min-w-0 flex-1' : 'w-full')}>
        <button
          type="button"
          disabled={!clickable}
          onClick={() => toggleOutput(s.id, s.status)}
          className={cn(
            !clickable && 'cursor-default',
            clickable && 'cursor-pointer',
            selected && clickable && 'ring-2 ring-sky-500/70 ring-offset-2 ring-offset-white  rounded-full'
          )}
          aria-label={
            clickable
              ? `${s.label} 산출물 ${selected ? '접기' : '펼치기'}`
              : `${s.label} ${s.status === 'pending' ? '대기' : s.status === 'running' ? '진행 중' : s.status === 'error' ? '오류' : ''}`
          }
        >
          {renderStepCircle(s)}
        </button>

        {compact ? (
          <div className="mt-2 flex w-[72px] flex-col items-center">
            <span className="line-clamp-2 text-center text-xs font-medium leading-tight text-gray-700 ">
              {s.label}
            </span>
            {s.status === 'running' && (
              <span className="mt-0.5 whitespace-nowrap text-[10px] text-blue-500 ">~{s.eta}</span>
            )}
            {s.status === 'done' && dur != null && (
              <span className="mt-0.5 text-[10px] text-gray-400 ">{dur}초</span>
            )}
            {s.status === 'skipped' && (
              <span className="mt-0.5 text-[10px] font-medium text-zinc-500 ">캐시 히트</span>
            )}
            {(s.status === 'pending' || s.status === 'error') && !(s.status === 'error' && onRetry) && (
              <span className="mt-0.5 block h-3" aria-hidden />
            )}
          </div>
        ) : null}
      </div>
    )
  }

  const connectorBetween = (left: MergedStage, right: MergedStage) => {
    const leftDone = left.status === 'done' || left.status === 'skipped'
    const rightRunning = right.status === 'running'

    if (leftDone && rightRunning) {
      return (
        <div
          className="mx-1 mt-4 h-0.5 min-w-[4px] flex-1 self-start bg-gradient-to-r from-green-400 to-blue-300 motion-safe:animate-pulse  "
          aria-hidden
        />
      )
    }
    if (leftDone) {
      return <div className="mx-1 mt-4 h-0.5 min-w-[4px] flex-1 self-start bg-green-400 " aria-hidden />
    }
    return (
      <div
        className="mx-1 mt-4 h-px min-w-[4px] flex-1 self-start border-t-2 border-dashed border-gray-200 "
        aria-hidden
      />
    )
  }

  const renderLabelsVertical = (s: MergedStage) => {
    const dur = stageDurationSec(s.startedAt, s.completedAt)
    return (
      <div className="min-w-0 flex-1 text-left">
        <p
          className={cn(
            'text-sm font-medium leading-snug text-gray-800 ',
            s.status === 'running' && 'font-semibold text-blue-900 ',
            s.status === 'pending' && 'text-zinc-500 ',
            s.status === 'error' && 'font-semibold text-red-700 ',
            (s.status === 'done' || s.status === 'skipped') && 'text-zinc-800 '
          )}
        >
          {s.label}
        </p>
        {s.status === 'running' ? (
          <p className="mt-0.5 whitespace-nowrap text-[10px] text-blue-500 ">~{s.eta}</p>
        ) : s.status === 'error' ? (
          <p className="mt-0.5 text-[10px] text-red-600 ">단계 오류</p>
        ) : (
          <p className="mt-0.5 text-[10px] text-zinc-400 ">예상 {s.eta}</p>
        )}
        {s.status === 'done' && dur != null && (
          <p className="mt-0.5 text-[10px] text-gray-400 ">{dur}초 소요</p>
        )}
        {s.status === 'error' && onRetry ? (
          <button
            type="button"
            className="mt-1 text-[10px] font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 "
            onClick={() => onRetry(s.id)}
          >
            재시도
          </button>
        ) : null}
      </div>
    )
  }

  const outputBlock =
    outputOpenId != null ? (
      <AnimatePresence initial={false}>
        <motion.div
          key={outputOpenId}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80  "
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold text-zinc-800 "
            onClick={() => setDetailExpanded((e) => !e)}
          >
            <span>{stageById(outputOpenId)?.label ?? outputOpenId} 단계 출력</span>
            {detailExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          </button>
          {detailExpanded ? (
            <pre className="max-h-[200px] overflow-auto border-t border-zinc-200 px-3 py-2 text-[11px] leading-relaxed text-zinc-800  ">
              {formatRawJson(merged.find((m) => m.id === outputOpenId)?.rawOutput)}
            </pre>
          ) : null}
        </motion.div>
      </AnimatePresence>
    ) : null

  const kw = keyword?.trim()
  const cc = countryLabel?.trim()

  return (
    <div className="w-full space-y-3">
      {hasError ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2  "
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
          <span className="text-sm font-medium text-red-800 ">
            {merged[errorIdx]?.label ?? '해당'} 단계 오류 · 재시도 가능
          </span>
        </div>
      ) : allDone ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2  "
          role="status"
          aria-live="polite"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-green-500" aria-hidden />
          <span className="text-sm font-medium text-green-800 ">분석 완료</span>
          <span className="text-sm text-green-600 ">
            {kw && cc ? `${kw} · ${cc}` : kw ? kw : cc ? cc : ''}
            {totalAnalysisSec != null ? ` · ${totalAnalysisSec}초 소요` : ''}
          </span>
        </div>
      ) : (
        <div
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2  "
          role="status"
          aria-live="polite"
        >
          <div className="h-2 w-2 shrink-0 rounded-full bg-blue-500 motion-safe:animate-pulse" aria-hidden />
          <span className="text-sm font-medium text-blue-800 ">분석 진행 중</span>
          <span className="text-sm text-blue-600 ">
            {doneCount}/9 단계 완료
          </span>
          {nextStageName && (
            <span className="ml-auto text-xs text-blue-500 ">
              다음 단계: {nextStageName} (~약 {runningEtaSec}초)
            </span>
          )}
        </div>
      )}

      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <div className="rounded-xl border border-zinc-200/90 bg-white px-2 py-4 shadow-sm sm:px-3  ">
          <div className="flex w-full min-w-0 items-start justify-center">
            {merged.map((s, i) => (
              <div key={s.id} className="contents">
                {i > 0 ? connectorBetween(merged[i - 1]!, s) : null}
                <div className="flex min-w-0 flex-1 flex-col items-center px-0.5">
                  {renderNodeShell(s, true)}
                </div>
              </div>
            ))}
          </div>
          {merged.some((s) => s.status === 'error' && onRetry) ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-zinc-100 pt-3 ">
              {merged.map((s) =>
                s.status === 'error' && onRetry ? (
                  <Button
                    key={`retry-${s.id}`}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1 border-red-300 text-red-800 hover:bg-red-50   "
                    onClick={() => onRetry(s.id)}
                  >
                    이 단계만 재시도
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
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-left text-sm font-semibold text-zinc-900 shadow-sm   "
          aria-expanded={mobileOpen}
        >
          <span>
            파이프라인 <span className="font-normal text-zinc-500 ">{doneCount}/9</span>
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
              <div className="mt-2 space-y-0 rounded-xl border border-zinc-200/90 bg-white px-3 py-3  ">
                {merged.map((s, i) => {
                  const isLast = i === merged.length - 1
                  const lineDone = s.status === 'done' || s.status === 'skipped'
                  return (
                    <div key={s.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        {renderNodeShell(s, false)}
                        {!isLast ? (
                          <div
                            className={cn(
                              'my-0.5 min-h-[14px] w-0.5 flex-1 rounded-full',
                              lineDone ? 'bg-green-400 ' : 'bg-zinc-200 '
                            )}
                            aria-hidden
                          />
                        ) : null}
                      </div>
                      <div className={cn('min-w-0 flex-1 pb-4', isLast && 'pb-0')}>
                        {renderLabelsVertical(s)}
                        {s.status === 'error' && onRetry ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-2 gap-1 border-red-300 text-xs text-red-800  "
                            onClick={() => onRetry(s.id)}
                          >
                            이 단계만 재시도
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                {outputBlock ? <div className="pt-1">{outputBlock}</div> : null}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
