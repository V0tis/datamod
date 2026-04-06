import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { dashboardCardClass, dashboardCardPadding } from '@/components/dashboard/dashboard-tokens'

export type DashboardCardEmphasis = 'hero' | 'default'

export type DashboardCardShellProps = {
  id?: string
  titleId?: string
  'aria-label'?: string
  title: string
  description?: string
  icon?: ReactNode
  headerRight?: ReactNode
  lead?: ReactNode
  children: ReactNode
  footer?: ReactNode
  emphasis?: DashboardCardEmphasis
  /** 액션층 등: 헤더·간격 축소 */
  compact?: boolean
  className?: string
}

/**
 * 대시보드 카드: 흰 배경, #E5E7EB 테두리, 12px radius, 20–24px 패딩.
 * 본문은 여백으로 구분 (라인 최소화).
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
  compact = false,
  className,
}: DashboardCardShellProps) {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      className={cn(
        dashboardCardClass,
        emphasis === 'hero' && 'shadow-md ring-1 ring-slate-200/80 dark:ring-zinc-700',
        className
      )}
    >
      <div className={cn('flex flex-col', compact ? 'gap-4 p-4 sm:p-5' : cn('gap-6', dashboardCardPadding))}>
        {lead != null && lead !== false ? <div className="min-w-0">{lead}</div> : null}

        <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between', compact ? 'gap-2' : 'gap-4')}>
          <div className={cn('flex min-w-0 flex-1', compact ? 'gap-2.5' : 'gap-3')}>
            {icon != null ? (
              <div
                className={cn(
                  'flex shrink-0 items-center justify-center rounded-lg',
                  compact ? 'h-9 w-9' : 'h-10 w-10',
                  emphasis === 'hero'
                    ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                )}
                aria-hidden
              >
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-0.5">
              <h2
                id={titleId}
                className={cn(
                  'font-semibold tracking-tight text-neutral-900 dark:text-zinc-50',
                  compact ? 'text-base' : emphasis === 'hero' ? 'text-xl sm:text-2xl' : 'text-lg'
                )}
              >
                {title}
              </h2>
              {description ? (
                <p
                  className={cn(
                    'leading-snug text-slate-600 dark:text-zinc-400',
                    compact ? 'text-xs' : 'text-sm'
                  )}
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {headerRight != null ? <div className="shrink-0 sm:pt-0.5">{headerRight}</div> : null}
        </div>

        <div className="min-w-0 text-sm leading-normal text-neutral-800 dark:text-zinc-200">{children}</div>

        {footer != null && footer !== false ? (
          <div className="min-w-0 text-sm text-slate-600 dark:text-zinc-400">{footer}</div>
        ) : null}
      </div>
    </section>
  )
}
