'use client'

import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface ErrorStateProps {
  /** Short headline — e.g. "분석을 완료하지 못했습니다" */
  title: string
  /** What happened and why (user-friendly). */
  description: string
  /** Recovery: label for the primary action — e.g. "다시 시도" (button is rendered by the component). */
  recoveryLabel: string
  /** Called when user clicks the recovery button. */
  onRecovery: () => void
  /** Optional technical detail (e.g. raw error message). Shown in smaller text. */
  detail?: string
  /** Optional secondary action (e.g. "설정으로 이동"). */
  secondaryAction?: React.ReactNode
  className?: string
  /** Variant: 'default' (red/destructive) or 'warning' (amber, e.g. quota). */
  variant?: 'default' | 'warning'
}

/**
 * Standard error state: explains what went wrong and suggests recovery.
 * Always includes a primary recovery action so users know what to do next.
 */
export function ErrorState({
  title,
  description,
  recoveryLabel,
  onRecovery,
  detail,
  secondaryAction,
  className,
  variant = 'default',
}: ErrorStateProps) {
  const isWarning = variant === 'warning'
  return (
    <div
      className={cn(
        'rounded-xl border p-6 text-center max-w-lg mx-auto',
        isWarning
          ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
          : 'border-destructive/30 dark:border-rose-900/50 bg-destructive/5 dark:bg-rose-950/20',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          'inline-flex items-center justify-center w-12 h-12 rounded-full mb-4',
          isWarning
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
            : 'bg-destructive/10 dark:bg-rose-900/40 text-destructive dark:text-rose-400'
        )}
      >
        <AlertCircle className="w-6 h-6" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-foreground dark:text-slate-200 mb-2">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground dark:text-slate-400 mb-4">
        {description}
      </p>
      {detail && (
        <p
          className={cn(
            'text-xs mb-4 break-words',
            isWarning ? 'text-amber-700 dark:text-amber-300' : 'text-destructive dark:text-rose-400'
          )}
        >
          {detail}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="sm" onClick={onRecovery}>
          {recoveryLabel}
        </Button>
        {secondaryAction}
      </div>
    </div>
  )
}
