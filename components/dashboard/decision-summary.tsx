'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { DashboardCardShell } from '@/components/dashboard/dashboard-card-shell'
import { Compass, LineChart, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DecisionSummaryData = {
  recommendedKeyword: string | null
  /** 0–100 when backed by opportunity score; null for trend-only or empty */
  confidence: number | null
  confidenceLabel: string
  reasons: string[]
  strategyHref: string | null
  source: 'opportunity' | 'trend' | 'empty'
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
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">다음 행동</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto sm:min-w-[140px] h-11 text-base font-semibold shadow-sm"
          onClick={onStartAnalysis}
          disabled={startDisabled || loading}
        >
          <Sparkles className="mr-2 h-4 w-4" aria-hidden />
          분석 시작
        </Button>
        {strategyHref ? (
          <Button variant="outline" size="lg" className="w-full sm:w-auto h-11 text-base font-medium" asChild>
            <Link href={`${strategyHref}#section-strategic-recommendations`}>전략 보기</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto h-11 text-base" disabled>
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
      description="완료된 분석·트렌드 신호를 바탕으로 오늘의 우선 키워드를 제안합니다."
    >
      {loading ? (
        <div className="space-y-4 animate-pulse py-1">
          <div className="h-10 w-2/3 max-w-md rounded-lg bg-muted/70" />
          <div className="h-9 w-40 rounded-md bg-muted/50" />
          <div className="h-4 w-full max-w-lg rounded bg-muted/40" />
          <div className="h-4 w-full max-w-md rounded bg-muted/30" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">추천 키워드</p>
            <p className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl break-words">
              {recommendedKeyword ?? '키워드를 입력해 첫 분석을 시작하세요'}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium tabular-nums',
                  source === 'opportunity' && confidence != null
                    ? 'border-border bg-muted/60 text-foreground'
                    : 'border-transparent bg-muted/40 text-muted-foreground'
                )}
              >
                <LineChart className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                {confidenceLabel}
              </span>
              {source === 'trend' && (
                <span className="text-xs text-muted-foreground">트렌드 신호 기반</span>
              )}
              {source === 'empty' && (
                <span className="text-xs text-muted-foreground">데이터가 쌓이면 자동 추천</span>
              )}
            </div>
          </div>

          {reasons.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">왜 이 키워드인가</p>
              <ul className="space-y-3 rounded-xl border border-border/70 bg-muted/15 px-4 py-4 dark:bg-muted/10">
                {reasons.slice(0, 2).map((r, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-foreground/95">
                    <span className="font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </DashboardCardShell>
  )
}
