'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { getAnalysisErrorMessage } from '@/lib/analysis-error-messages'
import { cn } from '@/lib/utils'

export interface AnalysisFailureBannerProps {
  /** Raw error (string or object with message/error) */
  error?: unknown
  /** Retry callback */
  onRetry: () => void
  /** Optional: show link to settings (for quota errors) */
  showSettingsLink?: boolean
  className?: string
}

/**
 * Compact error banner for analysis failure.
 * Shows meaningful message and retry option; prevents full-page crash.
 */
export function AnalysisFailureBanner({
  error,
  onRetry,
  showSettingsLink = true,
  className,
}: AnalysisFailureBannerProps) {
  const { title, description, variant, recoveryHint } = getAnalysisErrorMessage(error)
  const isQuota = variant === 'quota'

  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4',
        isQuota ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5',
        className
      )}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div
          className={cn(
            'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            isQuota ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
          )}
        >
          <AlertCircle className="w-5 h-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          {recoveryHint && (
            <p className="text-xs text-muted-foreground mt-1">{recoveryHint}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <Button size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          다시 분석
        </Button>
        {isQuota && showSettingsLink && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">설정으로 이동</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
