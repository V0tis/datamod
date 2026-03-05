'use client'

import { Shield, TrendingUp, MessageCircle, Rocket, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SignalStrength = 'High' | 'Medium' | 'Low'

export interface DataSourceWithSignal {
  name: string
  label?: string
  strength?: SignalStrength
}

const DEFAULT_DATA_SOURCES: DataSourceWithSignal[] = [
  { name: 'Google Trends', label: 'Google Trends signal', strength: 'High' },
  { name: 'Reddit', label: 'Reddit discussion', strength: 'Medium' },
  { name: 'Product Hunt', label: 'Product Hunt launches', strength: 'High' },
  { name: 'Startup funding reports', label: 'Startup funding reports', strength: 'High' },
]

const SOURCE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Google Trends': TrendingUp,
  Reddit: MessageCircle,
  'Product Hunt': Rocket,
  'Startup funding reports': BarChart3,
  '레딧 토론': MessageCircle,
  'Product Hunt 런칭': Rocket,
  'VC 시장 리포트': BarChart3,
}

function getSourceIcon(name: string) {
  if (SOURCE_ICONS[name]) return SOURCE_ICONS[name]
  if (/reddit|레딧/i.test(name)) return MessageCircle
  if (/product.?hunt|런칭/i.test(name)) return Rocket
  if (/trend|트렌드/i.test(name)) return TrendingUp
  if (/funding|펀딩|vc|startup|시장 리포트/i.test(name)) return BarChart3
  return BarChart3
}

function signalStrengthColor(strength: SignalStrength): string {
  if (strength === 'High') return 'text-emerald-600 dark:text-emerald-500'
  if (strength === 'Medium') return 'text-amber-600 dark:text-amber-500'
  return 'text-muted-foreground'
}

export interface AIConfidenceCardProps {
  /** Confidence score 0–100 */
  score?: number | null
  /** Data sources with optional signal strength */
  dataSources?: DataSourceWithSignal[] | string[]
  loading?: boolean
  className?: string
}

function confidenceColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

function normalizeSources(
  sources: AIConfidenceCardProps['dataSources']
): DataSourceWithSignal[] {
  if (!sources || sources.length === 0) return DEFAULT_DATA_SOURCES
  return sources.map((s) =>
    typeof s === 'string'
      ? {
          name: s,
          label: s,
          strength: 'Medium' as SignalStrength,
        }
      : s
  )
}

export function AIConfidenceCard({
  score,
  dataSources,
  loading = false,
  className,
}: AIConfidenceCardProps) {
  const hasScore = score != null && Number.isFinite(score)
  const normScore = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null
  const sources = normalizeSources(dataSources ?? DEFAULT_DATA_SOURCES)

  if (loading && !hasScore) {
    return (
      <section
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
          className
        )}
        aria-label="AI Confidence"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-4 w-28 rounded bg-muted/60 animate-pulse" />
          </div>
          <div className="h-10 w-16 rounded-lg bg-muted/40 animate-pulse mb-3" />
          <div className="h-2.5 w-full rounded-full bg-muted/40 animate-pulse mb-6" />
          <div className="h-4 w-24 rounded bg-muted/30 animate-pulse mb-3" />
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                <div className="h-8 w-8 rounded-md bg-muted/40 animate-pulse" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-24 rounded bg-muted/30 animate-pulse" />
                  <div className="h-4 w-12 rounded bg-muted/40 animate-pulse" />
                </div>
              </div>
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
      aria-label="AI Confidence"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            AI Confidence
          </h2>
        </div>

        {/* Confidence score */}
        <div className="mb-6">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground">
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
        </div>

        {/* Data Sources with icons and signal strength */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Data Sources
          </h3>
          <ul className="space-y-2">
            {sources.map((source, i) => {
              const Icon = getSourceIcon(source.name)
              const strength = source.strength ?? 'Medium'
              const displayLabel = source.label ?? `${source.name} signal`
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background border border-border/60">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">
                      {displayLabel}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        signalStrengthColor(strength)
                      )}
                    >
                      {strength}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
