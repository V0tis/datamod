'use client'

import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

function chipTitle(t: string): string {
  const s = t.trim()
  if (s.length <= 32) return s
  return `${s.slice(0, 30)}…`
}

export function KeyTrendsChipsSection({ trends }: { trends: string[] }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
  }, [trends])

  if (trends.length === 0) return null

  const safe = Math.min(active, trends.length - 1)

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm  ">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 ">
          <TrendingUp className="h-4 w-4 text-violet-700 " aria-hidden />
        </div>
        <span className="text-sm font-bold text-slate-900 ">핵심 트렌드</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600  ">
          {trends.length}개
        </span>
      </div>

      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
        {trends.map((t, i) => (
          <button
            key={`${i}-${t.slice(0, 12)}`}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              'flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              safe === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200   '
            )}
          >
            {chipTitle(t)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/90 p-4  ">
        <p className="text-pretty text-sm leading-relaxed text-blue-900 ">{trends[safe]}</p>
      </div>
    </div>
  )
}
