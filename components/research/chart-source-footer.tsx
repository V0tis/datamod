import { cn } from '@/lib/utils'

export const DEFAULT_CHART_SOURCE_TAG =
  'Source: Google News API, RSS Feed Cross-analysis'

export function ChartSourceFooter({
  text = DEFAULT_CHART_SOURCE_TAG,
  className,
}: {
  text?: string
  className?: string
}) {
  return (
    <p className={cn('mt-2 text-[10px] leading-snug text-muted-foreground/90', className)} role="note">
      {text}
    </p>
  )
}
