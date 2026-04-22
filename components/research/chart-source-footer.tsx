import { cn } from '@/lib/utils'

export const DEFAULT_CHART_SOURCE_TAG = '데이터 출처: RSS 피드 및 AI 종합'

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
