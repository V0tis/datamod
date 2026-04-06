import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const divider = <div className="h-px w-full shrink-0 bg-border" role="separator" />

export type DashboardCardEmphasis = 'hero' | 'default' | 'subtle'

export type DashboardCardShellProps = {
  id?: string
  titleId?: string
  'aria-label'?: string
  title: string
  description?: string
  icon?: ReactNode
  /** 헤더 우측 액션(국가 칩, 링크 등) */
  headerRight?: ReactNode
  /**
   * 카드 최상단에 배치(의사결정 카드: 주요 CTA를 먼저).
   */
  lead?: ReactNode
  children: ReactNode
  footer?: ReactNode
  emphasis?: DashboardCardEmphasis
  className?: string
}

/**
 * 대시보드 카드 공통 골격: (선택 lead) → 제목/설명 → 구분선 → 본문 → 구분선 → 푸터 CTA
 */
export function DashboardCardShell({
  id,
  titleId,
  'aria-label': ariaLabel,
  title,
  description,
  icon,
  headerRight,
  lead,
  children,
  footer,
  emphasis = 'default',
  className,
}: DashboardCardShellProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn(
        'overflow-hidden rounded-2xl border border-border text-card-foreground shadow-sm',
        emphasis === 'hero' &&
          'border-primary/20 bg-card shadow-md ring-1 ring-primary/10 dark:border-primary/25',
        emphasis === 'default' && 'bg-card',
        emphasis === 'subtle' && 'border-border/80 bg-muted/20 shadow-none dark:bg-muted/15',
        className
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        {lead != null && lead !== false && (
          <>
            <div className="min-w-0">{lead}</div>
            {divider}
          </>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            {icon != null && (
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  emphasis === 'hero' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}
                aria-hidden
              >
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h2>
              {description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
              ) : null}
            </div>
          </div>
          {headerRight != null ? <div className="shrink-0 sm:pt-0.5">{headerRight}</div> : null}
        </div>

        {divider}

        <div className="min-w-0 space-y-4 text-sm leading-normal">{children}</div>

        {footer != null && footer !== false ? (
          <>
            {divider}
            <div className="min-w-0 pt-0">{footer}</div>
          </>
        ) : null}
      </div>
    </section>
  )
}
