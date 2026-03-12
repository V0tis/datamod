'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Circle } from 'lucide-react'
import { PROGRESS_STEPS } from '@/lib/analysis-activity-messages'
import { cn } from '@/lib/utils'
import { motionConfig } from '@/lib/motion-config'

export interface AnalysisProgressInlineProps {
  progressIndex: number
  progressPercent: number
  stepLabel: string
  className?: string
}

/**
 * Compact progress UI for the result page hero: smooth progress bar,
 * fade-in on step change, and checkmark animation when a step completes.
 */
export function AnalysisProgressInline({
  progressIndex,
  progressPercent,
  stepLabel,
  className,
}: AnalysisProgressInlineProps) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="분석 진행 중">
      {/* Step label: fade-in when step changes */}
      <div className="flex items-center justify-between text-xs">
        <AnimatePresence mode="wait">
          <motion.span
            key={progressIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="font-medium text-muted-foreground"
          >
            단계 {progressIndex + 1}/{PROGRESS_STEPS.length} · {stepLabel}
          </motion.span>
        </AnimatePresence>
        <motion.span
          key={`pct-${progressIndex}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="font-semibold tabular-nums text-primary shrink-0 ml-2"
        >
          {Math.round(progressPercent)}%
        </motion.span>
      </div>

      {/* Progress bar: smooth width transition */}
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={false}
          animate={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          transition={{ type: 'tween', duration: motionConfig.progress.duration, ease: motionConfig.progress.ease }}
          role="progressbar"
          aria-valuenow={Math.round(progressPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Step indicators: checkmark when done, spinner for active */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {PROGRESS_STEPS.map((step, i) => {
          const isDone = i < progressIndex
          const isActive = i === progressIndex
          return (
            <motion.div
              key={step.id}
              initial={false}
              className={cn(
                'flex items-center justify-center rounded-full transition-colors duration-300',
                isDone && 'bg-primary/20 text-primary',
                isActive && 'bg-primary/20 text-primary',
                !isDone && !isActive && 'bg-muted/50 text-muted-foreground'
              )}
              style={{ width: 20, height: 20 }}
              aria-hidden
            >
              {isDone ? (
                <motion.div
                  key={`done-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </motion.div>
              ) : isActive ? (
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
              ) : (
                <Circle className="h-2.5 w-2.5" strokeWidth={2} />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
