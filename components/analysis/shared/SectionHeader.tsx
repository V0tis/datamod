'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface SectionHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  badge?: string
  badgeVariant?: 'blue' | 'green' | 'orange' | 'gray'
  action?: { label: string; onClick: () => void }
  /** `action` 대신 링크·커스텀 컨트롤 등을 올릴 때 */
  rightSlot?: ReactNode
  status?: 'generating' | 'done' | 'error'
  className?: string
}

const BADGE: Record<NonNullable<SectionHeaderProps['badgeVariant']>, string> = {
  blue: 'border border-[var(--dm-color-border)] bg-[var(--dm-color-primary-light)] text-[var(--dm-color-primary)]',
  green:
    'border border-[var(--dm-color-border)] bg-[var(--dm-color-success-light)] text-[var(--dm-color-success)]',
  orange:
    'border border-[var(--dm-color-border)] bg-[var(--dm-color-warning-light)] text-[var(--dm-color-warning)]',
  gray: 'border border-[var(--dm-color-border)] bg-[var(--dm-color-bg)] text-[var(--dm-color-text-secondary)]',
}

const STATUS_CHIP: Record<NonNullable<SectionHeaderProps['status']>, { className: string; label: string }> = {
  generating: {
    className:
      'border border-[var(--dm-color-border)] bg-[var(--dm-color-primary-light)] text-[var(--dm-color-primary)]',
    label: '생성 중',
  },
  done: {
    className:
      'border border-[var(--dm-color-border)] bg-[var(--dm-color-success-light)] text-[var(--dm-color-success)]',
    label: '완료',
  },
  error: {
    className:
      'border border-[var(--dm-color-border)] bg-[var(--dm-color-danger-light)] text-[var(--dm-color-danger)]',
    label: '오류',
  },
}

/**
 * B2B analytics section header: icon box + title + optional badge + status + action + bottom rule.
 */
export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeVariant = 'blue',
  action,
  rightSlot,
  status,
  className,
}: SectionHeaderProps) {
  const st = status ? STATUS_CHIP[status] : null

  return (
    <div className={cn('w-full border-b border-[var(--dm-color-border)] pb-3', className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--dm-color-primary-light)] text-[var(--dm-color-primary)]"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-title font-semibold leading-tight">{title}</h2>
            {badge ? (
              <span
                className={cn(
                  'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  BADGE[badgeVariant]
                )}
              >
                {badge}
              </span>
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-caption mt-0.5">{subtitle}</p>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          {st ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                st.className
              )}
            >
              {status === 'generating' ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : status === 'done' ? (
                <CheckCircle2 className="h-3 w-3" aria-hidden />
              ) : (
                <AlertCircle className="h-3 w-3" aria-hidden />
              )}
              {st.label}
            </span>
          ) : null}
          {rightSlot ??
            (action ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 border-[var(--dm-color-border-strong)] text-[13px] font-semibold text-[var(--dm-color-primary)] hover:bg-[var(--dm-color-primary-light)]"
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ) : null)}
        </div>
      </div>
    </div>
  )
}
