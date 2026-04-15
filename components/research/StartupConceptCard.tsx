'use client'

import { Lightbulb, Users, DollarSign, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StartupConceptData {
  productIdea?: string
  targetCustomer?: string
  monetization?: string
  goToMarket?: string[]
}

export interface StartupConceptCardProps {
  productIdea?: string | null
  targetCustomer?: string | null
  monetization?: string | null
  goToMarket?: string[]
  /** Fallback: first product action or opportunity when structured fields missing */
  fallbackProductIdea?: string | null
  /** Fallback: keyword + "관련 시장" when target missing */
  fallbackTargetHint?: string | null
  keyword?: string
  className?: string
  /** 이중 테두리·그라데이션 제거, 정보 밀도 우선 */
  variant?: 'default' | 'flat'
}

/**
 * Actionable startup concept: Product Idea, Target Customer, Monetization, Go-to-Market Strategy.
 * Structured for quick scanning and execution.
 */
export function StartupConceptCard({
  productIdea,
  targetCustomer,
  monetization,
  goToMarket = [],
  fallbackProductIdea,
  fallbackTargetHint,
  keyword = '',
  className,
  variant = 'default',
}: StartupConceptCardProps) {
  const flat = variant === 'flat'
  const idea = (productIdea || fallbackProductIdea || '').trim()
  const target = (targetCustomer || fallbackTargetHint || (keyword ? `${keyword} 관련 시장` : '')).trim()
  const monet = (monetization || '').trim()
  const gtm = Array.isArray(goToMarket) ? goToMarket.filter((s) => s && typeof s === 'string') : []

  const hasAny = idea || target || monet || gtm.length > 0

  if (!hasAny) return null

  const blocks = [
    { key: 'product', label: '제품 아이디어', value: idea, icon: Lightbulb },
    { key: 'target', label: '타겟 고객', value: target, icon: Users },
    { key: 'monetization', label: '수익화 방안', value: monet, icon: DollarSign },
    { key: 'gtm', label: 'Go-to-Market 전략', value: gtm.length > 0 ? gtm.join(' · ') : null, icon: Rocket },
  ].filter((b) => b.value)

  return (
    <div
      className={cn(
        flat
          ? 'border-b border-border/50 pb-6'
          : 'rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4 sm:p-5',
        className
      )}
    >
      <h3
        className={cn(
          'font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2',
          flat ? 'text-xs' : 'text-sm'
        )}
      >
        <Lightbulb className="h-4 w-4 text-primary" />
        실행 가능한 스타트업 컨셉
      </h3>

      <div
        className={cn(
          'grid gap-4',
          flat ? 'grid-cols-1 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3' : 'grid-cols-1 sm:grid-cols-2 gap-4'
        )}
      >
        {blocks.map(({ key, label, value, icon: Icon }) => (
          <div
            key={key}
            className={cn(
              'min-h-0',
              flat
                ? 'grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 border-b border-border/35 pb-3 last:border-b-0 sm:pb-3'
                : 'rounded-lg border border-border/60 bg-card/50 p-3 sm:p-4'
            )}
          >
            <div className={cn('flex items-center gap-2', flat && 'self-start pt-0.5')}>
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            </div>
            <p className={cn('text-sm font-medium text-foreground leading-snug', flat && 'min-w-0')}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
