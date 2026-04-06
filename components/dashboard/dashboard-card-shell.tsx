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
      <div className={cn('flex flex-col gap-6', dashboardCardPadding)}>
        {lead != null && lead !== false ? <div className="min-w-0">{lead}</div> : null}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            {icon != null ? (
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                  emphasis === 'hero'
                    ? 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                )}
                aria-hidden
              >
                {icon}
              </div>
            ) : null}
            <div className="min-w-0 flex-1 space-y-1">
              <h2
                id={titleId}
                className={cn(
                  'font-semibold tracking-tight text-neutral-900 dark:text-zinc-50',
                  emphasis === 'hero' ? 'text-xl sm:text-2xl' : 'text-lg'
                )}
              >
                {title}
              </h2>
              {description ? (
                <p className="text-sm leading-snug text-slate-600 dark:text-zinc-400">{description}</p>
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
