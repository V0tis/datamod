'use client'

import { cn } from '@/lib/utils'

const DEFAULT_TYPES = ['경쟁 포지션', '시장 공백', '대응 방향'] as const

export function MarketPositioningInsightsCards({
  bullets,
  className,
}: {
  bullets: string[]
  className?: string
}) {
  const clean = bullets.map((b) => b.trim()).filter(Boolean)
  if (clean.length === 0) return null

  const insights = clean.slice(0, 3).map((content, i) => ({
    type: DEFAULT_TYPES[i] ?? `인사이트 ${i + 1}`,
    content,
  }))

  return (
    <div
      className={cn(
        'rounded-xl border border-slate-100 bg-white p-4 shadow-sm   sm:p-5',
        className
      )}
    >
      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 ">
        시장 포지셔닝 인사이트
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {insights.map((insight, i) => (
          <div
            key={`${i}-${insight.content.slice(0, 24)}`}
            className="rounded-lg border border-slate-100 bg-slate-50/90 p-3  "
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-100 ">
                <span className="text-xs font-bold text-blue-600 ">{i + 1}</span>
              </div>
              <span className="text-xs font-semibold text-slate-700 ">{insight.type}</span>
            </div>
            <p className="text-pretty text-sm leading-relaxed text-slate-600 ">{insight.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
