'use client'

import Link from 'next/link'
import { LineChart, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { dashboardCardClass, dashboardMint } from '@/components/dashboard/dashboard-tokens'
import type { DecisionSummaryData } from '@/components/dashboard/decision-summary'

export function DashboardInsightStrip({
  loading,
  data,
  onStartAnalysis,
  startDisabled,
}: {
  loading: boolean
  data: DecisionSummaryData
  onStartAnalysis: () => void
  startDisabled?: boolean
}) {
  const line1 =
    data.recommendedKeyword != null
      ? `우선 과제: ${data.recommendedKeyword}`
      : '키워드 분석을 시작하면 코호트 기반 시그널이 여기 요약됩니다.'
  const line2 =
    data.reasons.length > 0
      ? data.reasons.slice(0, 2).join(' · ')
      : 'GTM·시장 선점 관점에서 다음 액션을 제안합니다.'

  return (
    <div className={cn(dashboardCardClass, 'p-4 sm:p-5')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: 'rgba(42, 193, 188, 0.14)' }}
        >
          <LineChart className="h-5 w-5" style={{ color: dashboardMint }} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 ">AI 인사이트</p>
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 w-full max-w-md animate-pulse rounded bg-slate-100 " />
              <div className="h-4 w-4/5 max-w-sm animate-pulse rounded bg-slate-100 " />
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug text-slate-900 ">{line1}</p>
              <p className="text-xs leading-relaxed text-slate-600 ">{line2}</p>
            </>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="inline-flex items-center gap-2 border-0 font-semibold text-white shadow-sm hover:opacity-95"
          style={{ backgroundColor: dashboardMint }}
          onClick={onStartAnalysis}
          disabled={startDisabled || loading}
        >
          <Play size={20} className="shrink-0" fill="currentColor" aria-hidden />
          분석 시작
        </Button>
        {data.strategyHref ? (
          <Button variant="secondary" size="sm" asChild>
            <Link href={`${data.strategyHref}#tab-insight`}>전략 보기</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
