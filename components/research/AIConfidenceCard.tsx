'use client'

import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_DATA_SOURCES = [
  'Google Trends',
  '레딧 토론',
  'Product Hunt 런칭',
  'VC 시장 리포트',
]

export interface AIConfidenceCardProps {
  /** Confidence score 0–100 */
  score?: number | null
  /** Data sources used in analysis */
  dataSources?: string[]
  loading?: boolean
  className?: string
}

function confidenceColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function AIConfidenceCard({
  score,
  dataSources = DEFAULT_DATA_SOURCES,
  loading = false,
  className,
}: AIConfidenceCardProps) {
  const hasScore = score != null && Number.isFinite(score)
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null

  if (loading && !hasScore) {
    return (
      <section
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
          className
        )}
        aria-label="AI 신뢰도"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted/60 animate-pulse" />
          </div>
          <div className="h-3 w-full rounded-full bg-muted/40 animate-pulse mb-4" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-24 rounded-md bg-muted/30 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (!hasScore) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        'bg-gradient-to-b from-muted/10 to-transparent',
        className
      )}
      aria-label="AI 신뢰도"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            AI 신뢰도
          </h2>
        </div>

        {/* Confidence score + progress bar */}
        <div className="mb-5">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-2xl sm:text-3xl font-bold tabular-nums text-foreground">
              {normScore}%
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                confidenceColor(normScore ?? 0)
              )}
              style={{ width: `${normScore}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            AI가 수집한 데이터와 분석 결과를 기반으로 산출된 신뢰도입니다.
          </p>
        </div>

        {/* Data sources as badges */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            데이터 출처
          </h3>
          <div className="flex flex-wrap gap-2">
            {dataSources.map((source, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-muted/60 text-foreground border border-border/60"
              >
                {source}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
