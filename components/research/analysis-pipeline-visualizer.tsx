'use client'

import { Fragment } from 'react'
import { Check, Loader2, Circle, AlertTriangle, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROGRESS_STEPS } from '@/lib/analysis-activity-messages'

/** 스텝퍼 한 줄 라벨 (가로 배치용) */
const STEP_COMPACT_KO = [
  '데이터 수집',
  '시장 리서치',
  '경쟁사',
  '인사이트',
  '전략',
  'PM 액션',
  '리스크·기회',
] as const

export type StepUiKind = 'done' | 'running' | 'pending' | 'failed' | 'skipped' | 'after_failure'

export function getPipelineStepUi(
  index: number,
  progressIndex: number,
  isRunning: boolean,
  options: {
    refiningPhase: 1 | 2 | 3 | null
    instantComplete?: boolean
    failedAtIndex?: number | null
    skippedIndices?: readonly number[]
  }
): StepUiKind {
  const { refiningPhase, instantComplete, failedAtIndex, skippedIndices } = options
  const skipped = new Set(skippedIndices ?? [])
  if (instantComplete) return 'done'
  if (failedAtIndex != null) {
    if (index < failedAtIndex) return 'done'
    if (index === failedAtIndex) return 'failed'
    return 'after_failure'
  }
  if (skipped.has(index)) return 'skipped'
  if (index < progressIndex) return 'done'
  if (index > progressIndex) return 'pending'
  // index === progressIndex
  if (!isRunning && !refiningPhase) return 'done'
  return 'running'
}

function StepDot({
  kind,
  small,
}: {
  kind: StepUiKind
  small?: boolean
}) {
  const size = small ? 'h-7 w-7' : 'h-8 w-8'
  const iconSm = small ? 'h-3.5 w-3.5' : 'h-4 w-4'
  if (kind === 'done') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-green-500 text-white dark:bg-green-600',
          size
        )}
      >
        <Check className={iconSm} strokeWidth={2.5} aria-hidden />
      </div>
    )
  }
  if (kind === 'running') {
    return (
      <div className={cn('relative flex shrink-0 items-center justify-center', size)}>
        <div
          className="absolute inset-0 rounded-full border-2 border-blue-400 opacity-50 motion-safe:animate-ping dark:border-sky-400"
          aria-hidden
        />
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/50',
            size
          )}
        >
          <Loader2 className={cn(iconSm, 'animate-spin text-blue-500 dark:text-sky-400')} strokeWidth={2} aria-hidden />
        </div>
      </div>
    )
  }
  if (kind === 'failed') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2 border-red-600 bg-red-500 text-white dark:border-red-500',
          size
        )}
      >
        <AlertTriangle className={iconSm} aria-hidden />
      </div>
    )
  }
  if (kind === 'skipped') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-white text-muted-foreground dark:border-zinc-600 dark:bg-zinc-900',
          size
        )}
      >
        <Minus className={iconSm} aria-hidden />
      </div>
    )
  }
  if (kind === 'after_failure') {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-muted-foreground opacity-50 dark:border-zinc-700 dark:bg-zinc-900',
          size
        )}
      >
        <Circle className={iconSm} strokeWidth={2} aria-hidden />
      </div>
    )
  }
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-muted-foreground dark:border-zinc-600 dark:bg-zinc-900',
        size
      )}
    >
      <Circle className={iconSm} strokeWidth={2} aria-hidden />
    </div>
  )
}

function ConnectorSegment({
  progressIndex,
  segmentStartIndex,
  isRunning,
}: {
  progressIndex: number
  segmentStartIndex: number
  isRunning: boolean
}) {
  const leftDone = segmentStartIndex < progressIndex
  const rightRunning = segmentStartIndex + 1 === progressIndex && isRunning

  if (leftDone && rightRunning) {
    return (
      <div
        className="mt-[15px] h-0.5 min-w-[2px] flex-1 rounded-full bg-gradient-to-r from-green-400 to-blue-300 motion-safe:animate-pulse dark:from-green-500 dark:to-blue-400"
        aria-hidden
      />
    )
  }
  if (leftDone) {
    return (
      <div
        className="mt-[15px] h-0.5 min-w-[2px] flex-1 rounded-full bg-green-400 dark:bg-green-500"
        aria-hidden
      />
    )
  }
  return (
    <div
      className="mt-[15px] h-px min-w-[2px] flex-1 border-t-2 border-dashed border-gray-200 dark:border-zinc-600"
      aria-hidden
    />
  )
}

export function AnalysisPipelineDesktopStepper({
  progressIndex,
  isRunning,
  refiningPhase,
  instantComplete,
  failedAtIndex,
  skippedIndices,
  className,
}: {
  progressIndex: number
  isRunning: boolean
  refiningPhase: 1 | 2 | 3 | null
  instantComplete?: boolean
  failedAtIndex?: number | null
  skippedIndices?: readonly number[]
  className?: string
}) {
  return (
    <div className={cn('hidden w-full md:block', className)}>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        분석 단계 <span className="font-normal normal-case text-muted-foreground/80">(총 7단계)</span>
      </p>
      <div className="flex w-full min-w-0 items-start">
        {PROGRESS_STEPS.map((_, i) => {
          const kind = getPipelineStepUi(i, progressIndex, isRunning, {
            refiningPhase,
            instantComplete,
            failedAtIndex: failedAtIndex ?? null,
            skippedIndices,
          })
          const lineLeft = i > 0
          return (
            <Fragment key={_.id}>
              {lineLeft ? (
                <ConnectorSegment
                  progressIndex={progressIndex}
                  segmentStartIndex={i - 1}
                  isRunning={isRunning && !refiningPhase}
                />
              ) : null}
              <div className="flex w-[72px] shrink-0 flex-col items-center">
                <StepDot kind={kind} />
                <span
                  title={PROGRESS_STEPS[i].labelKo}
                  className={cn(
                    'mt-2 line-clamp-2 max-w-[72px] text-center text-[10px] font-medium leading-tight text-gray-700 dark:text-zinc-200',
                    kind === 'running' && 'font-semibold text-blue-800 dark:text-sky-200',
                    kind === 'done' && 'text-foreground/90',
                    (kind === 'pending' || kind === 'after_failure') && 'text-muted-foreground',
                    kind === 'failed' && 'text-destructive',
                    kind === 'skipped' && 'text-muted-foreground'
                  )}
                >
                  {STEP_COMPACT_KO[i]}
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

export function AnalysisPipelineMobileTimeline({
  progressIndex,
  isRunning,
  refiningPhase,
  instantComplete,
  failedAtIndex,
  skippedIndices,
  className,
}: {
  progressIndex: number
  isRunning: boolean
  refiningPhase: 1 | 2 | 3 | null
  instantComplete?: boolean
  failedAtIndex?: number | null
  skippedIndices?: readonly number[]
  className?: string
}) {
  const currentTitle = PROGRESS_STEPS[Math.min(progressIndex, PROGRESS_STEPS.length - 1)]?.labelKo ?? ''
  return (
    <div className={cn('w-full md:hidden', className)}>
      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
        <p className="text-xs font-semibold text-foreground">
          {instantComplete ? (
            <>
              저장된 분석 불러옴 · <span className="font-normal text-muted-foreground">7단계 요약</span>
            </>
          ) : (
            <>
              {progressIndex + 1} / {PROGRESS_STEPS.length}{' '}
              <span className="font-normal text-muted-foreground">· {currentTitle}</span>
            </>
          )}
        </p>
      </div>
      <ul className="mt-3 space-y-0" role="list" aria-label="분석 단계 타임라인">
        {PROGRESS_STEPS.map((step, i) => {
          const kind = getPipelineStepUi(i, progressIndex, isRunning, {
            refiningPhase,
            instantComplete,
            failedAtIndex: failedAtIndex ?? null,
            skippedIndices,
          })
          const isLast = i === PROGRESS_STEPS.length - 1
          const lineDone = i < progressIndex
          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex w-7 shrink-0 flex-col items-center">
                <StepDot kind={kind} small />
                {!isLast ? (
                  <div
                    className={cn(
                      'my-0.5 min-h-[14px] w-px flex-1 rounded-full',
                      lineDone ? 'bg-primary/55' : 'bg-border'
                    )}
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className={cn('min-w-0 flex-1 pb-3', isLast && 'pb-0')}>
                <p className="text-sm font-medium leading-snug text-foreground">{step.labelKo}</p>
                {kind === 'running' && <p className="mt-0.5 text-xs text-primary">진행 중</p>}
                {kind === 'failed' && (
                  <p className="mt-0.5 text-xs text-destructive">이 단계에서 오류가 발생했습니다</p>
                )}
                {kind === 'skipped' && <p className="mt-0.5 text-xs text-muted-foreground">건너뜀</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
