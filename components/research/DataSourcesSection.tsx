'use client'

import { Database, TrendingUp, MessageCircle, Rocket, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DataSourceConfidence = 'high' | 'medium' | 'low'

export interface DataSourceSignal {
  id: string
  source: string
  summary: string
  confidence: DataSourceConfidence
  icon?: React.ReactNode
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  'Google Trends': <TrendingUp className="h-4 w-4" />,
  'Reddit discussions': <MessageCircle className="h-4 w-4" />,
  'Product Hunt launches': <Rocket className="h-4 w-4" />,
  'VC funding data': <Wallet className="h-4 w-4" />,
}

function confidenceLabel(c: DataSourceConfidence): string {
  switch (c) {
    case 'high':
      return '높음'
    case 'medium':
      return '중간'
    case 'low':
      return '낮음'
    default:
      return '—'
  }
}

function confidenceColor(c: DataSourceConfidence): string {
  switch (c) {
    case 'high':
      return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
    case 'medium':
      return 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
    case 'low':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export interface DataSourcesSectionProps {
  signals: DataSourceSignal[]
  loading?: boolean
  className?: string
}

export function DataSourcesSection({
  signals,
  loading = false,
  className,
}: DataSourcesSectionProps) {
  if (loading && signals.length === 0) {
    return (
      <section
        className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
        aria-label="Data Sources"
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-primary" />
            Data Sources
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (signals.length === 0) return null

  return (
    <section
      className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
      aria-label="Data Sources"
    >
      <div className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          Data Sources
        </h2>
        <ul className="space-y-3">
          {signals.map((sig) => (
            <li
              key={sig.id}
              className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {sig.icon ?? SOURCE_ICONS[sig.source]}
                  {sig.source}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                    confidenceColor(sig.confidence)
                  )}
                  title={`신뢰도: ${confidenceLabel(sig.confidence)}`}
                >
                  {confidenceLabel(sig.confidence)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {sig.summary}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
