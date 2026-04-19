'use client'

import { cn } from '@/lib/utils'

type Props = {
  /** 0–10 만점 표시값 */
  value10: number
  className?: string
  /** 시각적 채움 비율(0–1). 미주입 시 value10/10 */
  fillRatio?: number
}

/** 차원 점수: 블록 바 + X/10 (별점 대체) */
export function DimensionScoreBar({ value10, className, fillRatio }: Props) {
  const v = Math.min(10, Math.max(0, Math.round(value10)))
  const ratio = fillRatio != null ? Math.min(1, Math.max(0, fillRatio)) : v / 10
  const filled = Math.round(ratio * 10)
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 text-sm', className)}
      aria-label={`10점 만점 중 ${v}점`}
    >
      <span
        className="inline-flex min-w-[7.5rem] select-none font-mono text-xs tracking-tight text-muted-foreground"
        aria-hidden
      >
        [
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={i < filled ? 'text-primary' : 'text-muted-foreground/35'}>
            {i < filled ? '█' : '░'}
          </span>
        ))}
        ]
      </span>
      <span className="tabular-nums text-sm font-semibold text-foreground">{v}/10</span>
    </div>
  )
}
