'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Check, Circle } from 'lucide-react'
import { RinAnimation } from '@/components/common/RinAnimation'
import {
  PROGRESS_STEPS,
  getProgressStepIndex,
  getEstimatedRemainingSeconds,
  getDynamicStepMessage,
} from '@/lib/analysis-activity-messages'
import { cn } from '@/lib/utils'

export interface AnalysisProgressOverlayProps {
  /** Current step ID from streaming (e.g. trend_analysis, competition_analysis) */
  stepId?: string | null
  /** Pipeline step index 0–5 */
  currentStep?: number
  /** Whether analysis is actively running */
  isRunning?: boolean
  /** Keyword being analyzed */
  keyword?: string
  /** Variant: overlay = full loading card, inline = compact banner */
  variant?: 'overlay' | 'inline'
  /** Show Lottie animation (overlay only) */
  showAnimation?: boolean
  className?: string
}

function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '곧 완료됩니다'
  if (seconds < 60) return `약 ${seconds}초 남음`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (s === 0) return `약 ${m}분 남음`
  return `약 ${m}분 ${s}초 남음`
}

export function AnalysisProgressOverlay({
  stepId,
  currentStep = 0,
  isRunning = true,
  keyword = '',
  variant = 'overlay',
  showAnimation = true,
  className,
}: AnalysisProgressOverlayProps) {
  const progressIndex = getProgressStepIndex(stepId, currentStep)
  const [dynamicMessage, setDynamicMessage] = useState(() =>
    getDynamicStepMessage(progressIndex)
  )
  const [stepStartTime, setStepStartTime] = useState(() => Date.now())

  useEffect(() => {
    if (!isRunning) return
    setStepStartTime(Date.now())
  }, [progressIndex, isRunning])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setDynamicMessage(getDynamicStepMessage(progressIndex, stepStartTime))
    }, 1500)
    return () => clearInterval(interval)
  }, [isRunning, progressIndex, stepStartTime])

  const progressPercent = Math.min(
    100,
    ((progressIndex + 1) / PROGRESS_STEPS.length) * 100
  )
  const remainingSeconds = getEstimatedRemainingSeconds(progressIndex)

  const content = (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
        'p-4 sm:p-5 flex flex-col gap-4',
        variant === 'overlay' && 'shadow-lg max-w-md w-full',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="AI 분석 진행 중"
    >
      <div className="flex items-start gap-3 shrink-0">
        {variant === 'overlay' && showAnimation ? (
          <div className="shrink-0">
            <RinAnimation variant="loading" size={140} className="block" />
          </div>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {isRunning ? 'AI 분석 진행 중' : '분석 준비 중'}
          </p>
          <AnimatePresence mode="wait">
            <motion.p
              key={progressIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="text-sm text-muted-foreground mt-0.5"
            >
              {isRunning ? dynamicMessage : '잠시만 기다려 주세요.'}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* Animated progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <AnimatePresence mode="wait">
            <motion.span
              key={progressIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="font-medium text-muted-foreground"
            >
              단계 {progressIndex + 1}/{PROGRESS_STEPS.length}
            </motion.span>
          </AnimatePresence>
          <motion.span
            key={`pct-${progressIndex}`}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="font-semibold tabular-nums text-primary"
          >
            {Math.round(progressPercent)}%
          </motion.span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full relative"
            initial={false}
            animate={{ width: `${Math.min(100, progressPercent)}%` }}
            transition={{ type: 'tween', duration: 0.6, ease: 'easeInOut' }}
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="분석 진행률"
          >
            {isRunning && (
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                style={{ width: '100%' }}
              />
            )}
          </motion.div>
        </div>
        {isRunning && remainingSeconds > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatRemainingTime(remainingSeconds)}
          </p>
        )}
      </div>

      {/* 5 progressive steps */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          분석 단계
        </p>
        <ul className="space-y-2" role="list">
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < progressIndex
            const isActive = i === progressIndex
            return (
              <li
                key={step.id}
                className={cn(
                  'flex items-center gap-3 text-sm transition-all duration-300',
                  isDone && 'opacity-100',
                  isActive && 'opacity-100',
                  !isDone && !isActive && 'opacity-50'
                )}
              >
                {isDone ? (
                  <motion.div
                    key={`done-${i}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  </motion.div>
                ) : isActive ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                    <Circle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </div>
                )}
                <span
                  className={cn(
                    'font-medium',
                    isDone && 'text-foreground',
                    isActive && 'text-foreground',
                    !isDone && !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.labelKo}
                  {isActive && (
                    <span className="ml-1.5 text-primary font-normal">진행 중</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {keyword && variant === 'overlay' && (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 animate-in fade-in duration-300"
          role="status"
        >
          <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-0.5">
            분석 대상
          </p>
          <p className="text-sm text-foreground">
            &quot;{keyword}&quot; 시장 분석을 수행하고 있습니다.
          </p>
        </div>
      )}
    </div>
  )

  if (variant === 'overlay') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        {content}
      </div>
    )
  }

  return content
}
