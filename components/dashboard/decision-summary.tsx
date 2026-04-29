'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardCardShell } from '@/components/dashboard/dashboard-card-shell'
import { Compass, LineChart, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DecisionSummaryData = {
  recommendedKeyword: string | null
  confidence: number | null
  confidenceLabel: string
  reasons: string[]
  strategyHref: string | null
  source: 'opportunity' | 'trend' | 'empty' | 'live_insight'
}

type DecisionSummaryProps = {
  loading: boolean
  data: DecisionSummaryData
  onStartAnalysis: () => void
  startDisabled?: boolean
}

export function DecisionSummary({ loading, data, onStartAnalysis, startDisabled }: DecisionSummaryProps) {
  const { recommendedKeyword, confidence, confidenceLabel, reasons, strategyHref, source } = data

  const primaryActions = (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">다음 행동</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="lg"
          className="h-11 w-full text-base font-semibold shadow-sm sm:w-auto sm:min-w-[140px]"
          onClick={onStartAnalysis}
          disabled={startDisabled || loading}
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          분석 시작
        </Button>
        {strategyHref ? (
          <Button variant="secondary" size="lg" className="h-11 w-full text-base font-medium sm:w-auto" asChild>
            <Link href={`${strategyHref}#section-strategic-recommendations`}>전략 보기</Link>
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="lg" className="h-11 w-full text-base sm:w-auto" disabled>
            전략 보기
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <DashboardCardShell
      aria-label="의사결정 요약"
      emphasis="hero"
      lead={primaryActions}
      icon={<Compass className="h-5 w-5" aria-hidden />}
      title="지금 집중할 시장"
      description="데이터 기반 우선 키워드 · 한눈에 결정"
    >
      {loading ? (
        <div className="space-y-4 py-1">
          <div className="h-10 w-2/3 max-w-md animate-pulse rounded-lg bg-slate-100 " />
          <div className="h-9 w-40 animate-pulse rounded-md bg-slate-100 " />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-slate-100 " />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">추천</p>
            <p className="break-words text-3xl font-bold leading-tight tracking-tight text-neutral-900  sm:text-4xl">
              {recommendedKeyword ?? '키워드 입력 후 첫 분석'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-slate-50 px-3 py-1.5 text-sm font-medium tabular-nums  ',
                  source === 'opportunity' && confidence != null ? 'text-neutral-900 ' : 'text-slate-600 '
                )}
              >
                <LineChart className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                {confidenceLabel}
              </span>
              {source === 'trend' && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800  ">
                  성장 중
                </span>
              )}
              {source === 'live_insight' && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800  ">
                  실시간 분석
                </span>
              )}
              {source === 'empty' && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600  ">
                  데이터 대기
                </span>
              )}
            </div>
          </div>

          {reasons.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {reasons.slice(0, 2).map((r, i) => (
                <span
                  key={i}
                  className="inline-flex max-w-full items-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-xs font-medium leading-snug text-neutral-800   "
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardCardShell>
  )
}
