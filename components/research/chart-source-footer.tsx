import { cn } from '@/lib/utils'

export const DEFAULT_CHART_SOURCE_TAG = 'Data Source: RSS Feed & AI Synthesis'

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
