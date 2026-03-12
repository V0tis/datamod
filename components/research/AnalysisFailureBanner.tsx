'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
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
  /** Optional: keyword being analyzed (for logging) */
  keyword?: string
  className?: string
}

/**
 * Error banner for analysis failure.
 * Clear explanation, possible causes, retry and back-to-dashboard actions.
 * Logs error details for debugging.
 */
export function AnalysisFailureBanner({
  error,
  onRetry,
  showSettingsLink = true,
  keyword,
  className,
}: AnalysisFailureBannerProps) {
  const { title, description, variant, recoveryHint, possibleCauses } = getAnalysisErrorMessage(error)
  const isQuota = variant === 'quota'

  useEffect(() => {
    if (error != null && typeof window !== 'undefined') {
      const msg = typeof error === 'string' ? error : (error as { message?: string; error?: string })?.message ?? (error as { error?: string })?.error ?? JSON.stringify(error)
      console.warn('[AnalysisFailure]', {
        keyword: keyword ?? '(unknown)',
        variant,
        message: msg,
        raw: error,
      })
    }
  }, [error, variant, keyword])

  return (
    <div
      role="alert"
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        isQuota ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5',
        className
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div
            className={cn(
              'shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
              isQuota ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
            )}
          >
            <AlertCircle className="w-5 h-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            {recoveryHint && (
              <p className="text-xs text-muted-foreground mt-1">{recoveryHint}</p>
            )}
            {possibleCauses && possibleCauses.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  가능한 원인
                </p>
                <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                  {possibleCauses.map((cause, i) => (
                    <li key={i}>{cause}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onRetry} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            다시 분석
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/" className="gap-1.5">
              <Home className="w-3.5 h-3.5" />
              대시보드로
            </Link>
          </Button>
          {isQuota && showSettingsLink && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">설정으로 이동</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
