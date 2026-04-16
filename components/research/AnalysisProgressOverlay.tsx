'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { RinAnimation } from '@/components/common/RinAnimation'
import {
  PROGRESS_STEPS,
  getProgressStepIndex,
  getEstimatedRemainingSeconds,
  getDynamicStepMessage,
  getLongStepMessage,
  LONG_STEP_THRESHOLD_SEC,
} from '@/lib/analysis-activity-messages'
import { cn } from '@/lib/utils'
import {
  AnalysisPipelineDesktopStepper,
  AnalysisPipelineMobileTimeline,
} from '@/components/research/analysis-pipeline-visualizer'

/** 분석 진행 문구를 한 글자씩 노출 (메시지가 바뀌면 처음부터 다시 타이핑) */
export function useAnalysisTypewriter(fullText: string, active: boolean, msPerChar = 22) {
  const [display, setDisplay] = useState(() => (active ? '' : fullText))

  useEffect(() => {
    if (!active) {
      setDisplay(fullText)
      return
    }
    setDisplay('')
    if (!fullText) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setDisplay(fullText.slice(0, i))
      if (i >= fullText.length) window.clearInterval(id)
    }, msPerChar)
    return () => window.clearInterval(id)
  }, [fullText, active, msPerChar])

  return display
}

export interface AnalysisProgressOverlayProps {
  /** Current step ID from streaming (e.g. trend_analysis, competition_analysis) */
  stepId?: string | null
  /** Pipeline step index 0–5 */
  currentStep?: number
  /** Whether analysis is actively running */
  isRunning?: boolean
  /** Keyword being analyzed */
  keyword?: string
  /**
   * 스트림 기반 구체 메시지(건수·타임스탬프 등). 있으면 우선 표시하고 타이핑 효과 적용.
   * 없으면 단계별 동적 메시지(getDynamicStepMessage) 사용.
   */
  detailMessage?: string
  /** Variant: overlay = full loading card, inline = compact banner */
  variant?: 'overlay' | 'inline'
  /** Show Lottie animation (overlay only) */
  showAnimation?: boolean
  /** 최종 정제 구간 — 진행률 95% 고정 후 마지막 단계에서 100% */
  refiningPhase?: 1 | 2 | 3 | null
  className?: string
  /** 캐시 등으로 단계 스트림 없이 즉시 완료된 경우 — 7단계 전체 완료 표시 */
  instantComplete?: boolean
  /** 실패한 진행 단계 인덱스(0–6). 있으면 해당 칸만 오류 스타일 */
  failedAtProgressIndex?: number | null
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '곧 완료됩니다'
  if (seconds < 60) return `약 ${seconds}초 남음`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (s === 0) return `약 ${m}분 남음`
  return `약 ${m}분 ${s}초 남음`
}

function formatClock(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AnalysisProgressOverlay({
  stepId,
  currentStep = 0,
  isRunning = true,
  keyword = '',
  detailMessage,
  variant = 'overlay',
  showAnimation = true,
  refiningPhase = null,
  className,
  instantComplete = false,
  failedAtProgressIndex = null,
}: AnalysisProgressOverlayProps) {
  const progressIndex = getProgressStepIndex(stepId, currentStep)
  /** 캐시 즉시 완료 시 전체 단계 완료로 표시 */
  const displayProgressIndex = instantComplete ? PROGRESS_STEPS.length - 1 : progressIndex
  const effectiveRunning = instantComplete ? false : isRunning
  const [stepStartTime, setStepStartTime] = useState(() => Date.now())
  const [dynamicMessage, setDynamicMessage] = useState(() =>
    getDynamicStepMessage(progressIndex)
  )
  const useDetail = Boolean(detailMessage?.trim())
  const typedDetail = useAnalysisTypewriter(detailMessage ?? '', effectiveRunning && useDetail)

  const runStartedAtRef = useRef<number | null>(null)
  const [timeTick, setTimeTick] = useState(0)

  useEffect(() => {
    if (!effectiveRunning || instantComplete) return
    if (runStartedAtRef.current == null) runStartedAtRef.current = Date.now()
    const id = window.setInterval(() => setTimeTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [effectiveRunning, instantComplete])

  useEffect(() => {
    if (!effectiveRunning) return
    setStepStartTime(Date.now())
  }, [progressIndex, effectiveRunning])

  useEffect(() => {
    if (!effectiveRunning || useDetail) return
    const interval = setInterval(() => {
      const elapsedSec = (Date.now() - stepStartTime) / 1000
      if (elapsedSec >= LONG_STEP_THRESHOLD_SEC) {
        setDynamicMessage(getLongStepMessage(progressIndex))
      } else {
        setDynamicMessage(getDynamicStepMessage(progressIndex, stepStartTime))
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [effectiveRunning, progressIndex, stepStartTime, useDetail])

  const subtitleLine =
    instantComplete
      ? '저장된 분석을 불러왔습니다. 아래 단계는 요약 표시입니다.'
      : effectiveRunning && useDetail
        ? typedDetail
        : effectiveRunning
          ? dynamicMessage
          : '잠시만 기다려 주세요.'

  const naturalPercent = Math.min(
    100,
    ((displayProgressIndex + 1) / PROGRESS_STEPS.length) * 100
  )
  const progressPercent =
    refiningPhase === 1 || refiningPhase === 2
      ? 95
      : refiningPhase === 3
        ? 100
        : instantComplete
          ? 100
          : naturalPercent
  const remainingSeconds =
    refiningPhase != null || instantComplete ? 0 : getEstimatedRemainingSeconds(displayProgressIndex)

  const totalElapsedSec =
    runStartedAtRef.current != null && effectiveRunning && !instantComplete
      ? (Date.now() - runStartedAtRef.current) / 1000
      : 0
  const stepElapsedSec =
    effectiveRunning && !instantComplete ? (Date.now() - stepStartTime) / 1000 : 0
  void timeTick

  const currentStepLabel =
    refiningPhase != null
      ? `최종 정제 (${refiningPhase}/3)`
      : (PROGRESS_STEPS[displayProgressIndex]?.labelKo ?? '')
  const nextStepLabel =
    !instantComplete && displayProgressIndex < PROGRESS_STEPS.length - 1
      ? (PROGRESS_STEPS[displayProgressIndex + 1]?.labelKo ?? '')
      : null

  const [a11yMessage, setA11yMessage] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (instantComplete) {
        setA11yMessage('저장된 분석을 불러왔습니다. 단계 진행 없이 결과를 표시합니다.')
        return
      }
      if (!effectiveRunning) {
        setA11yMessage('')
        return
      }
      if (refiningPhase != null) {
        setA11yMessage(`최종 정제 ${refiningPhase}단계입니다. 곧 완료됩니다.`)
        return
      }
      const label = PROGRESS_STEPS[displayProgressIndex]?.labelKo ?? ''
      setA11yMessage(
        `시장 분석 ${displayProgressIndex + 1}단계, ${label}을 진행 중입니다. 총 ${PROGRESS_STEPS.length}단계 중입니다.`
      )
    }, 400)
    return () => clearTimeout(t)
  }, [displayProgressIndex, effectiveRunning, refiningPhase, instantComplete])

  const content = (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {a11yMessage}
      </div>
      <div
        className={cn(
          'rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
          'flex flex-col gap-4 p-4 sm:p-5',
          variant === 'overlay' && 'w-full max-w-2xl shadow-lg',
          className
        )}
      >
        <div className="flex shrink-0 items-start gap-3">
          {instantComplete ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/20">
              <CheckCircle2 className="h-6 w-6 text-primary" aria-hidden />
            </div>
          ) : variant === 'overlay' && showAnimation ? (
            <div className="shrink-0">
              <RinAnimation variant="loading" size={140} className="block" />
            </div>
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/20">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-foreground">
                {instantComplete
                  ? '분석 결과 불러오기'
                  : effectiveRunning
                    ? refiningPhase != null
                      ? '최종 정제 중'
                      : 'AI 분석 진행 중'
                    : '분석 준비 중'}
              </p>
              {instantComplete ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                  캐시에서 불러옴
                </span>
              ) : null}
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={`${progressIndex}-${useDetail ? detailMessage?.slice(0, 48) : 'dyn'}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="mt-0.5 text-sm text-muted-foreground"
              >
                {subtitleLine}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="tabular-nums">
            전체 경과 {formatClock(totalElapsedSec)}
            {effectiveRunning && !instantComplete ? (
              <>
                {' '}
                · 이 단계 {formatClock(stepElapsedSec)}
              </>
            ) : null}
          </span>
          {nextStepLabel && effectiveRunning && !instantComplete && !refiningPhase ? (
            <span className="text-muted-foreground/90 sm:text-right">
              다음: <span className="font-medium text-foreground/90">{nextStepLabel}</span>
            </span>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <AnimatePresence mode="wait">
              <motion.span
                key={displayProgressIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="font-medium text-muted-foreground"
              >
                {refiningPhase != null
                  ? `정제 ${refiningPhase}/3`
                  : instantComplete
                    ? `단계 ${PROGRESS_STEPS.length}/${PROGRESS_STEPS.length}`
                    : `단계 ${displayProgressIndex + 1}/${PROGRESS_STEPS.length}`}
              </motion.span>
            </AnimatePresence>
            <motion.span
              key={`pct-${displayProgressIndex}-${instantComplete}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="font-semibold tabular-nums text-primary"
            >
              {Math.round(progressPercent)}%
            </motion.span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="relative h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${Math.min(100, progressPercent)}%` }}
              transition={{
                type: 'tween',
                duration: refiningPhase === 3 ? 0.55 : 0.6,
                ease: refiningPhase === 3 ? 'easeOut' : 'easeInOut',
              }}
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="분석 진행률"
            >
              {effectiveRunning && !instantComplete && (
                <div
                  className="absolute inset-0 w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                  style={{ width: '100%' }}
                />
              )}
            </motion.div>
          </div>
          {effectiveRunning && remainingSeconds > 0 && !instantComplete ? (
            <p className="text-xs text-muted-foreground">{formatRemainingTime(remainingSeconds)}</p>
          ) : null}
        </div>

        <div className="hidden rounded-lg border border-border/50 bg-background/40 px-3 py-2 md:block">
          <p className="text-[11px] font-medium text-muted-foreground">현재 단계</p>
          <p className="text-sm font-semibold text-foreground">{currentStepLabel}</p>
          {nextStepLabel && effectiveRunning && !instantComplete && !refiningPhase ? (
            <p className="mt-1 text-xs text-muted-foreground">
              다음 단계는 <span className="font-medium text-foreground/90">{nextStepLabel}</span>입니다.
            </p>
          ) : null}
        </div>

        <div aria-hidden="true">
          <AnalysisPipelineDesktopStepper
            progressIndex={displayProgressIndex}
            isRunning={effectiveRunning}
            refiningPhase={refiningPhase}
            instantComplete={instantComplete}
            failedAtIndex={failedAtProgressIndex ?? undefined}
          />

          <AnalysisPipelineMobileTimeline
            progressIndex={displayProgressIndex}
            isRunning={effectiveRunning}
            refiningPhase={refiningPhase}
            instantComplete={instantComplete}
            failedAtIndex={failedAtProgressIndex ?? undefined}
          />
        </div>

        {keyword && variant === 'overlay' ? (
          <div className="animate-in fade-in rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 duration-300">
            <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-primary">
              분석 대상
            </p>
            <p className="text-sm text-foreground">
              {instantComplete ? (
                <>
                  &quot;{keyword}&quot;에 대한 저장된 분석 결과를 불러옵니다.
                </>
              ) : (
                <>
                  &quot;{keyword}&quot; 시장 분석을 수행하고 있습니다.
                </>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </>
  )

  if (variant === 'overlay') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        {content}
      </div>
    )
  }

  return content
}
