'use client'

import { Loader2, Check, Circle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SectionStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface ProductStrategySectionProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  /** Scroll target id for section navigation */
  id?: string
  /** 분석 상태 - 카드 헤더에 표시 (PM 분석 도구용) */
  status?: SectionStatus
  loading?: boolean
  /** 스트리밍 완료 시 체크 아이콘 + "생성 완료" 표시 (Progressive Streaming UX) */
  streamingComplete?: boolean
  /** 대시보드형 리포트: 이중 카드·그림자 최소화 */
  variant?: 'default' | 'flat'
}

const STATUS_LABELS: Record<SectionStatus, string> = {
  pending: '대기중',
  running: '분석중...',
  completed: '완료',
  failed: '실패',
}

const StatusIcon = ({ status, loading }: { status: SectionStatus; loading?: boolean }) => {
  if (loading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
  switch (status) {
    case 'completed':
      return <Check className="h-3.5 w-3.5 text-primary" />
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
  }
}

/**
 * Section wrapper for product strategy report. Visually separated, scannable.
 */
export function ProductStrategySection({
  title,
  icon,
  children,
  className,
  id,
  status,
  loading,
  streamingComplete,
  variant = 'default',
}: ProductStrategySectionProps) {
  const showStatus = status != null || streamingComplete
  const displayLabel = streamingComplete ? '생성 완료' : status != null ? STATUS_LABELS[status] : null
  const displayIcon = streamingComplete ? <Check className="h-3.5 w-3.5 text-primary" /> : status != null ? <StatusIcon status={status} loading={status === 'running'} /> : null
  const flat = variant === 'flat'
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 overflow-visible',
        flat
          ? 'border-0 border-b border-border/45 bg-transparent pb-8 shadow-none'
          : 'rounded-xl border-2 border-border/70 bg-card bg-gradient-to-b from-card to-muted/5 shadow-sm',
        className
      )}
      aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 border-b border-border/60',
          flat ? 'bg-transparent px-0 py-3' : 'bg-muted/20 px-5 py-4 sm:px-6 sm:py-4'
        )}
      >
        <h2
          id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className={cn('font-semibold text-foreground flex items-center gap-2', flat ? 'text-sm' : 'text-base')}
        >
          {icon}
          {title}
        </h2>
        {showStatus && displayLabel && (
          <span className={cn(
            'flex items-center gap-1.5 text-xs font-medium shrink-0',
            streamingComplete ? 'text-primary' : 'text-muted-foreground'
          )}>
            {displayIcon}
            {displayLabel}
          </span>
        )}
      </div>
      <div className={cn(flat ? 'px-0 pt-6' : 'p-5 sm:p-6 md:p-6')}>{children}</div>
    </section>
  )
}
