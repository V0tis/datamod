'use client'

import { X, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimeAgo } from '@/components/time-ago'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { type AnalysisMode, ANALYSIS_MODE_CONFIG } from '@/lib/types/analysis-modes'

export interface ComparisonRecord {
  id: string
  keyword: string
  country_code: string
  analysis_mode?: AnalysisMode
  market_temperature_score?: number | null
  summary_insights?: string | null
  top_risk?: string | null
  top_action?: string | null
  updated_at: string | null
}

interface ComparisonViewProps {
  records: ComparisonRecord[]
  onClose: () => void
  className?: string
}

export function ComparisonView({ records, onClose, className }: ComparisonViewProps) {
  if (records.length === 0) return null

  const getTemperatureTrend = (score: number | null | undefined) => {
    if (score == null) return null
    if (score >= 70) return 'hot'
    if (score >= 40) return 'warm'
    return 'cold'
  }

  const getTemperatureColor = (trend: string | null) => {
    switch (trend) {
      case 'hot': return 'text-red-500'
      case 'warm': return 'text-amber-500'
      case 'cold': return 'text-blue-500'
      default: return 'text-muted-foreground'
    }
  }

  const getTrendIcon = (trend: string | null) => {
    switch (trend) {
      case 'hot': return <TrendingUp className="h-4 w-4" />
      case 'cold': return <TrendingDown className="h-4 w-4" />
      default: return <Minus className="h-4 w-4" />
    }
  }

  const highestTemp = Math.max(
    ...records.map((r) => r.market_temperature_score ?? 0)
  )
  const lowestTemp = Math.min(
    ...records.filter((r) => r.market_temperature_score != null).map((r) => r.market_temperature_score!)
  )

  return (
    <div className={cn('fixed inset-0 z-50 flex items-end sm:items-center justify-center', className)}>
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-auto m-4 rounded-xl border border-border bg-card shadow-lg">
        <div className="sticky top-0 flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4 z-10">
          <h2 className="text-lg font-semibold text-foreground">비교 분석</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className={cn(
            'grid gap-4',
            records.length === 2 && 'grid-cols-1 sm:grid-cols-2',
            records.length === 3 && 'grid-cols-1 sm:grid-cols-3'
          )}>
            {records.map((record) => {
              const tempTrend = getTemperatureTrend(record.market_temperature_score)
              const isHighest = record.market_temperature_score === highestTemp && highestTemp > 0
              const isLowest = record.market_temperature_score === lowestTemp && records.length > 1
              const resultsHref = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`

              return (
                <div
                  key={record.id}
                  className={cn(
                    'rounded-lg border p-4 space-y-4',
                    isHighest && 'border-red-500/30 bg-red-500/5',
                    isLowest && !isHighest && 'border-blue-500/30 bg-blue-500/5',
                    !isHighest && !isLowest && 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-foreground">{record.keyword}</h3>
                      {record.analysis_mode && (
                        <span className="text-xs text-primary">
                          {ANALYSIS_MODE_CONFIG[record.analysis_mode]?.labelKo}
                        </span>
                      )}
                    </div>
                    <Link
                      href={resultsHref}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">시장 온도</span>
                      {record.market_temperature_score != null ? (
                        <div className={cn('flex items-center gap-1', getTemperatureColor(tempTrend))}>
                          {getTrendIcon(tempTrend)}
                          <span className="font-semibold">{record.market_temperature_score}</span>
                          <span className="text-xs">/100</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    {record.summary_insights && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">요약</span>
                        <p className="text-sm text-foreground line-clamp-3">{record.summary_insights}</p>
                      </div>
                    )}

                    {record.top_action && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">우선 액션</span>
                        <p className="text-sm text-foreground line-clamp-2">{record.top_action}</p>
                      </div>
                    )}

                    {record.top_risk && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">주요 리스크</span>
                        <p className="text-sm text-foreground line-clamp-2">{record.top_risk}</p>
                      </div>
                    )}
                  </div>

                  {record.updated_at && (
                    <div className="pt-2 border-t border-border/60">
                      <TimeAgo isoString={record.updated_at} className="text-xs text-muted-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {records.length >= 2 && (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-medium text-foreground mb-3">비교 요약</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">시장 온도 범위</span>
                  <span className="font-medium text-foreground">
                    {lowestTemp} ~ {highestTemp}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">가장 뜨거운 시장</span>
                  <span className="font-medium text-red-500">
                    {records.find((r) => r.market_temperature_score === highestTemp)?.keyword ?? '—'}
                  </span>
                </div>
                {records.length > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">가장 차가운 시장</span>
                    <span className="font-medium text-blue-500">
                      {records.find((r) => r.market_temperature_score === lowestTemp)?.keyword ?? '—'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
