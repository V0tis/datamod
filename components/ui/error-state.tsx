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
          ? 'border-warning/30 bg-warning/5'
          : 'border-destructive/30 bg-destructive/5',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div
        className={cn(
          'inline-flex items-center justify-center w-12 h-12 rounded-full mb-4',
          isWarning
            ? 'bg-warning/10 text-warning'
            : 'bg-destructive/10 text-destructive'
        )}
      >
        <AlertCircle className="w-6 h-6" aria-hidden />
      </div>
      <h2 className="text-base font-semibold text-foreground mb-2">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        {description}
      </p>
      {detail && (
        <p
          className={cn(
            'text-xs mb-4 break-words',
            isWarning ? 'text-warning' : 'text-destructive'
          )}
        >
          {detail}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="secondary" size="sm" onClick={onRecovery}>
          {recoveryLabel}
        </Button>
        {secondaryAction}
      </div>
    </div>
  )
}
