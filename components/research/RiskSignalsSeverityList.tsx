'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, ChevronDown, ShieldCheck } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type { RiskSignalItem } from '@/lib/ai/pipeline-prompts'

export type RiskSignalsSeverityListProps = {
  /** `normalizeRiskSignalsFromParse` 등으로 정규화된 리스크 시그널 */
  items: RiskSignalItem[] | null | undefined
  className?: string
  /** 표시 상한 (기본 8) */
  maxItems?: number
}

/** 종합 점수 = severity × likelihood (최대 100) */
export function computeRiskTotalScore(item: RiskSignalItem): number {
  const s = Math.round(item.severity) * Math.round(item.likelihood)
  return Math.min(100, Math.max(1, s))
}

export type RiskSeverityTier = 'high' | 'medium' | 'low'

export function getRiskSeverityTier(score: number): RiskSeverityTier {
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

const tierConfig: Record<
  RiskSeverityTier,
  {
    label: string
    barClass: string
    stripeClass: string
    badgeClass: string
    iconClass: string
  }
> = {
  high: {
    label: '고위험',
    barClass: 'bg-rose-500 dark:bg-rose-500',
    stripeClass: 'bg-rose-500 dark:bg-rose-400',
    badgeClass: 'bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:text-rose-200 dark:ring-rose-400/30',
    iconClass: 'text-rose-600 dark:text-rose-400',
  },
  medium: {
    label: '중위험',
    barClass: 'bg-amber-500 dark:bg-amber-500',
    stripeClass: 'bg-amber-500 dark:bg-amber-400',
    badgeClass: 'bg-amber-500/12 text-amber-800 ring-amber-500/25 dark:text-amber-100 dark:ring-amber-400/30',
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
  low: {
    label: '저위험',
    barClass: 'bg-emerald-500 dark:bg-emerald-500',
    stripeClass: 'bg-emerald-500 dark:bg-emerald-400',
    badgeClass: 'bg-emerald-500/12 text-emerald-800 ring-emerald-500/20 dark:text-emerald-100 dark:ring-emerald-400/25',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
}

function mitigationHint(tier: RiskSeverityTier): string {
  switch (tier) {
    case 'high':
      return '단기 모니터링 KPI와 완화 시나리오(대안 시나리오·예산·정책 버퍼)를 정하고, 전략·제품 회의 안건으로 올려 우선 검토하는 것이 좋습니다.'
    case 'medium':
      return '주간 또는 월간 점검 리듬과 담당 역할을 정하고, 미리 정한 트리거 조건이 충족되면 에스컬레이션하세요.'
    default:
      return '인지만 유지하고 백로그에 기록해 두면 됩니다. 로드맵·리소스와 충돌할 때 다시 심각도를 재평가하세요.'
  }
}

function MiniBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
      <div className={cn('h-full rounded-full transition-all duration-300', className)} style={{ width: `${pct}%` }} />
    </div>
  )
}

function RiskSignalRow({ item }: { item: RiskSignalItem }) {
  const [open, setOpen] = useState(false)
  const total = computeRiskTotalScore(item)
  const tier = getRiskSeverityTier(total)
  const cfg = tierConfig[tier]
  const Icon = tier === 'high' ? AlertTriangle : tier === 'medium' ? AlertCircle : ShieldCheck

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm transition-shadow',
          open && 'shadow-md ring-1 ring-border/40'
        )}
      >
        <CollapsibleTrigger
          className={cn(
            'flex w-full items-stretch gap-0 text-left outline-none',
            'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
        >
          <div className={cn('w-1 shrink-0 rounded-l-2xl', cfg.stripeClass)} aria-hidden />
          <div className="flex min-w-0 flex-1 items-start gap-3 px-4 py-4 sm:gap-4 sm:px-5">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
                cfg.badgeClass
              )}
              aria-hidden
            >
              <Icon className={cn('h-5 w-5', cfg.iconClass)} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset',
                    cfg.badgeClass
                  )}
                >
                  {cfg.label}
                </span>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  종합 {total}/100
                </span>
                <span className="text-[11px] text-muted-foreground/80">
                  심각 {item.severity}/10 · 가능성 {item.likelihood}/10
                </span>
              </div>
              <p className="text-sm font-medium leading-snug text-foreground">{item.risk}</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>위험도 게이지 (심각도 × 가능성)</span>
                  <span className="tabular-nums">{total}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                  <div
                    className={cn('h-full rounded-full', cfg.barClass)}
                    style={{ width: `${total}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center justify-center gap-1 self-center pr-1">
              <span className="text-[10px] font-medium text-muted-foreground">{open ? '접기' : '자세히'}</span>
              <ChevronDown
                className={cn('h-5 w-5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
                aria-hidden
              />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-4 border-t border-border/50 bg-muted/20 px-4 py-4 sm:px-5 sm:py-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">심각도</p>
                <MiniBar value={item.severity} max={10} className={cfg.barClass} />
                <p className="text-xs tabular-nums text-muted-foreground">{item.severity} / 10</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">발생 가능성</p>
                <MiniBar value={item.likelihood} max={10} className={cfg.barClass} />
                <p className="text-xs tabular-nums text-muted-foreground">{item.likelihood} / 10</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/60 px-3 py-3 sm:px-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                PM 점검 · 대응 방향
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">{mitigationHint(tier)}</p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function RiskSignalsSeverityList({ items: rawItems, className, maxItems = 8 }: RiskSignalsSeverityListProps) {
  const items = useMemo(() => {
    const list = Array.isArray(rawItems) ? rawItems : []
    return [...list].sort((a, b) => computeRiskTotalScore(b) - computeRiskTotalScore(a)).slice(0, maxItems)
  }, [rawItems, maxItems])

  if (items.length === 0) return null

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">리스크 신호등</p>
          <p className="mt-0.5 text-xs text-muted-foreground/90">
            종합 점수 = 심각도 × 가능성 (최대 100). 고위험 60+, 중위험 30–59, 저위험 29 이하.
          </p>
        </div>
      </div>
      <ul className="list-none space-y-3 p-0">
        {items.map((item, i) => (
          <li key={`${item.risk.slice(0, 48)}-${i}`}>
            <RiskSignalRow item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}
