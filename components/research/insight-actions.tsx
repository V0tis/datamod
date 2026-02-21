'use client'

import { useState } from 'react'
import { Sparkles, Users, Loader2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface InsightActionsProps {
  keyword: string
  onDeepenAnalysis?: (keyword: string) => Promise<void>
  onCompetitorReinterpret?: (keyword: string) => Promise<void>
  className?: string
  disabled?: boolean
}

export function InsightActions({
  keyword,
  onDeepenAnalysis,
  onCompetitorReinterpret,
  className,
  disabled = false,
}: InsightActionsProps) {
  const [deepenLoading, setDeepenLoading] = useState(false)
  const [competitorLoading, setCompetitorLoading] = useState(false)

  const handleDeepenAnalysis = async () => {
    if (!onDeepenAnalysis || deepenLoading) return
    setDeepenLoading(true)
    try {
      await onDeepenAnalysis(keyword)
    } finally {
      setDeepenLoading(false)
    }
  }

  const handleCompetitorReinterpret = async () => {
    if (!onCompetitorReinterpret || competitorLoading) return
    setCompetitorLoading(true)
    try {
      await onCompetitorReinterpret(keyword)
    } finally {
      setCompetitorLoading(false)
    }
  }

  const isLoading = deepenLoading || competitorLoading

  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-foreground">추가 분석</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {onDeepenAnalysis && (
          <button
            type="button"
            onClick={handleDeepenAnalysis}
            disabled={disabled || isLoading}
            className={cn(
              'group flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
              'hover:border-primary/50 hover:bg-primary/5',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {deepenLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">심층 분석</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                더 자세한 시장 인사이트 생성
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </button>
        )}

        {onCompetitorReinterpret && (
          <button
            type="button"
            onClick={handleCompetitorReinterpret}
            disabled={disabled || isLoading}
            className={cn(
              'group flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
              'hover:border-amber-500/50 hover:bg-amber-500/5',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2'
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white">
              {competitorLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Users className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">경쟁사 관점</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                경쟁사 시점에서 재해석
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
          </button>
        )}
      </div>
    </div>
  )
}

interface QuickActionProps {
  icon: React.ElementType
  label: string
  description?: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'default' | 'primary' | 'warning'
}

export function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  loading = false,
  disabled = false,
  variant = 'default',
}: QuickActionProps) {
  const variantStyles = {
    default: {
      button: 'hover:border-border hover:bg-muted/50',
      icon: 'bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background',
    },
    primary: {
      button: 'hover:border-primary/50 hover:bg-primary/5',
      icon: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
    },
    warning: {
      button: 'hover:border-amber-500/50 hover:bg-amber-500/5',
      icon: 'bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-white',
    },
  }

  const styles = variantStyles[variant]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'group flex items-center gap-3 rounded-lg border p-3 text-left transition-all w-full',
        styles.button,
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2'
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
          styles.icon
        )}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </button>
  )
}
