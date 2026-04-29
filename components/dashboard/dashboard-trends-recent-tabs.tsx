'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { dashboardCardClass } from '@/components/dashboard/dashboard-tokens'

/**
 * 하단 액션층 우측: 급상승 트렌드 + 최근 분석을 단일 열(모듈형)로 표시.
 */
export function DashboardTrendsRecentTabs({
  trendsPanel,
  recentPanel,
  variant = 'card',
  className,
}: {
  trendsPanel: ReactNode
  recentPanel: ReactNode
  /** plain: 상위 카드 안에 넣을 때 테두리·그림자 제거 */
  variant?: 'card' | 'plain'
  className?: string
}) {
  const pad = variant === 'plain' ? 'px-4' : 'px-5'
  return (
    <section
      className={cn(
        variant === 'plain'
          ? 'flex min-h-[440px] flex-1 flex-col overflow-hidden border-0 bg-transparent shadow-none lg:min-h-[480px]'
          : cn(dashboardCardClass, 'min-h-[520px] shadow-sm lg:min-h-[560px]'),
        'flex flex-col',
        className
      )}
      aria-label="트렌드 및 최근 분석"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          id="dashboard-trends-block"
          className={cn('flex min-h-0 shrink-0 flex-col border-b border-[#E5E7EB] ', pad, 'pb-3 pt-3')}
        >
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 ">
            급상승 트렌드
          </h3>
          <div className="min-h-0 max-h-[min(52vh,420px)] flex-1 overflow-y-auto pr-0.5">{trendsPanel}</div>
        </div>
        <div
          id="dashboard-recent-block"
          className={cn('flex min-h-0 flex-1 flex-col', pad, 'pb-4 pt-4')}
        >
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 ">
            최근 분석
          </h3>
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{recentPanel}</div>
        </div>
      </div>
    </section>
  )
}
