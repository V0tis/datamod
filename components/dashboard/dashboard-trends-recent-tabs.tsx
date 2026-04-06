'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { dashboardCardClass } from '@/components/dashboard/dashboard-tokens'

/**
 * 하단 액션층 우측: 급상승 트렌드 / 최근 분석 탭 (배민 셀프서비스형).
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
      <Tabs defaultValue="trends" className="flex min-h-0 flex-1 flex-col">
        <div
          className={cn(
            'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] dark:border-zinc-800',
            variant === 'plain' ? 'px-4 pb-3 pt-3' : 'px-5 pb-4 pt-5'
          )}
        >
          <TabsList className="h-10 w-full justify-stretch rounded-xl bg-[#F8F9FA] p-1 sm:w-auto dark:bg-zinc-900">
            <TabsTrigger
              value="trends"
              className="flex-1 rounded-lg px-3 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#222] data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-zinc-100 sm:flex-none sm:px-4"
            >
              급상승 트렌드
            </TabsTrigger>
            <TabsTrigger
              value="recent"
              className="flex-1 rounded-lg px-3 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-[#222] data-[state=active]:shadow-sm dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-zinc-100 sm:flex-none sm:px-4"
            >
              최근 분석
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="trends"
          className={cn(
            'm-0 flex min-h-0 flex-1 flex-col pb-4 pt-2 focus-visible:ring-0 focus-visible:ring-offset-0',
            variant === 'plain' ? 'px-4' : 'px-5 pb-5 pt-3'
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{trendsPanel}</div>
        </TabsContent>
        <TabsContent
          value="recent"
          className={cn(
            'm-0 flex min-h-0 flex-1 flex-col pb-4 pt-2 focus-visible:ring-0 focus-visible:ring-offset-0',
            variant === 'plain' ? 'px-4' : 'px-5 pb-5 pt-3'
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">{recentPanel}</div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
