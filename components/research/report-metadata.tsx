'use client'

import { Calendar, Cpu, Target, TrendingUp, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import {
  type AnalysisMode,
  ANALYSIS_MODE_CONFIG,
} from '@/lib/types/analysis-modes'

interface ReportMetadataProps {
  analysisDate?: string | null
  analysisMode?: AnalysisMode
  modelInfo?: string | null
  confidence?: number | null
  analysisTarget?: string | null
  className?: string
}

const TARGET_LABELS: Record<string, string> = {
  product: '제품',
  company: '기업',
  market: '시장',
  person: '인물',
  policy: '정책',
  technology: '기술',
}

export function ReportMetadata({
  analysisDate,
  analysisMode = 'deep',
  modelInfo,
  confidence,
  analysisTarget,
  className,
}: ReportMetadataProps) {
  const modeConfig = ANALYSIS_MODE_CONFIG[analysisMode]
  const targetLabel = analysisTarget ? (TARGET_LABELS[analysisTarget] ?? analysisTarget) : null

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-success bg-success/10 border-success/20'
    if (score >= 60) return 'text-primary bg-primary/10 border-primary/20'
    if (score >= 40) return 'text-warning bg-warning/10 border-warning/20'
    return 'text-muted-foreground bg-muted border-border'
  }

  const getConfidenceLabel = (score: number) => {
    if (score >= 80) return '높음'
    if (score >= 60) return '보통'
    if (score >= 40) return '낮음'
    return '매우 낮음'
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Analysis Date */}
      {analysisDate && (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <TimeAgo isoString={analysisDate} />
        </div>
      )}

      {/* Analysis Mode */}
      <div className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary">
        <Target className="h-3 w-3 shrink-0" />
        <span>{modeConfig.labelKo}</span>
      </div>

      {/* Analysis Target */}
      {targetLabel && (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3 shrink-0" />
          <span>{targetLabel}</span>
        </div>
      )}

      {/* Model Info */}
      {modelInfo && (
        <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
          <Cpu className="h-3 w-3 shrink-0" />
          <span>{modelInfo}</span>
        </div>
      )}

      {/* Confidence Score */}
      {typeof confidence === 'number' && (
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium',
            getConfidenceColor(confidence)
          )}
        >
          <Shield className="h-3 w-3 shrink-0" />
          <span>신뢰도 {confidence}%</span>
          <span className="text-[10px] opacity-75">({getConfidenceLabel(confidence)})</span>
        </div>
      )}
    </div>
  )
}

interface CompactMetadataProps {
  analysisDate?: string | null
  analysisMode?: AnalysisMode
  confidence?: number | null
  className?: string
}

export function CompactMetadata({
  analysisDate,
  analysisMode = 'deep',
  confidence,
  className,
}: CompactMetadataProps) {
  const modeConfig = ANALYSIS_MODE_CONFIG[analysisMode]

  return (
    <div className={cn('flex items-center gap-3 text-xs text-muted-foreground', className)}>
      {analysisDate && <TimeAgo isoString={analysisDate} />}
      <span className="text-primary font-medium">{modeConfig.labelKo}</span>
      {typeof confidence === 'number' && (
        <span>신뢰도 {confidence}%</span>
      )}
    </div>
  )
}
