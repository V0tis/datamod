'use client'

import Link from 'next/link'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import { DashboardCountryTabsFour } from '@/components/dashboard/dashboard-country-tabs-four'
import { TimeAgo } from '@/components/time-ago'
import { inferTrendCategory } from '@/lib/dashboard-scatter-points'
import type { TrendItem } from '@/lib/trends-types'
import type { CountryChipCode } from '@/components/country-chips'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const sectionTitle = 'text-[14px] font-semibold tracking-[-0.01em] text-[#374151]'

const cardShell =
  'rounded-[12px] border border-[#E5E9F2] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]'

function pctChange(rank: number, seed: number): string {
  const base = Math.max(5, Math.min(48, (12 - rank) * 3 + (seed % 9)))
  return `+${base}%`
}

export type AiSignalCard = {
  keyword: string
  score: number
  insight: string
  href: string
}

export function DashboardRisingTrendsPanel({
  trendCountry,
  onTrendCountryChange,
  trendItems,
  trendsLoading,
  onTrendAnalyze,
  showAnalysisUI,
  maxItems = 8,
  showLinkToTrends = true,
  className,
}: {
  trendCountry: CountryChipCode
  onTrendCountryChange: (code: CountryChipCode) => void
  trendItems: TrendItem[]
  trendsLoading: boolean
  onTrendAnalyze: (item: TrendItem) => void
  showAnalysisUI: boolean
  maxItems?: number
  showLinkToTrends?: boolean
  className?: string
}) {
  const list = trendItems.slice(0, maxItems)

  return (
    <div className={cn(cardShell, 'flex min-h-0 min-w-0 flex-col', className)} style={{ padding: '20px 24px' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={sectionTitle}>급상승 트렌드</h2>
          <p className="mt-1 text-[12px] text-[#6B7280]">지역별 실시간 검색 급상승 키워드</p>
        </div>
        {showLinkToTrends ? (
          <Link href="/trends" className="text-[13px] font-medium text-blue-600 hover:underline">
            전체 보기
          </Link>
        ) : null}
      </div>
      <div className="mt-4">
        <DashboardCountryTabsFour value={trendCountry} onChange={onTrendCountryChange} />
      </div>
      <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto">
        {trendsLoading ? (
          [1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[12px] border border-[#F3F4F6] bg-slate-100" />
          ))
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7280]">표시할 비즈니스 관련 트렌드가 없습니다</p>
        ) : (
          list.map((item, i) => {
            const rank = typeof item.rank === 'number' ? item.rank : i + 1
            const seed = rank * 17 + item.keyword.length
            const category = inferTrendCategory(item.keyword)
            const title =
              trendCountry !== 'KR' && item.title_ko && item.title_ko !== item.keyword
                ? `${item.keyword} · ${item.title_ko}`
                : item.title_ko && item.title_ko !== item.keyword
                  ? item.title_ko
                  : item.keyword
            return (
              <button
                key={`${trendCountry}-${item.keyword}-${i}`}
                type="button"
                disabled={showAnalysisUI}
                onClick={() => onTrendAnalyze(item)}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-[12px] border border-[#E5E9F2] bg-[#FAFBFC] px-3 py-2.5 text-left transition hover:border-blue-300 hover:shadow-sm',
                  showAnalysisUI && 'pointer-events-none opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[13px] font-bold tabular-nums text-[#111827] shadow-sm">
                    {rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[#111827]">{title}</p>
                    <p className="mt-0.5 text-[11px] text-[#6B7280]">
                      <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-medium text-blue-800">{category}</span>
                      {` · ${
                        trendCountry === 'KR'
                          ? '한국'
                          : trendCountry === 'US'
                            ? '미국'
                            : trendCountry === 'JP'
                              ? '일본'
                              : '대만'
                      }`}
                      {item.started_at ? (
                        <>
                          {' · '}
                          <TimeAgo isoString={item.started_at} />
                        </>
                      ) : null}
                    </p>
                  </div>
                  <MiniSparkline seed={seed} tone="mint" className="h-8 w-[60px] shrink-0" />
                  <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold tabular-nums text-emerald-800">
                    {pctChange(rank, seed)} ↑
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

export function DashboardAiSignalsPanel({
  aiSignals,
  title = '시장 시그널',
  description = '고기회로 추정된 키워드와 한 줄 요약',
  className,
}: {
  aiSignals: AiSignalCard[]
  title?: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn(cardShell, className)} style={{ padding: '20px 24px' }}>
      <h2 className={sectionTitle}>{title}</h2>
      <p className="mt-1 text-[12px] text-[#6B7280]">{description}</p>
      <div className="mt-4 space-y-3">
        {aiSignals.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-[#E5E9F2] bg-slate-50/80 px-4 py-8 text-center text-sm text-[#6B7280]">
            분석·트렌드 데이터가 쌓이면 시그널 카드가 표시됩니다
          </div>
        ) : (
          aiSignals.slice(0, 3).map((sig) => (
            <div
              key={sig.keyword + sig.href}
              className="rounded-[12px] border border-[#E5E9F2] bg-gradient-to-br from-[#F8FAFC] to-white px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-[15px] font-bold text-[#111827]">{sig.keyword}</p>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[18px] font-bold tabular-nums text-emerald-800">
                  {sig.score}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-[#4B5563]">{sig.insight}</p>
              <div className="mt-3 flex justify-end">
                <Button variant="primary" size="sm" className="h-9 rounded-lg px-4 text-[13px] font-semibold" asChild>
                  <Link href={sig.href}>분석 열기</Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function DashboardBottomSection({
  trendCountry,
  onTrendCountryChange,
  trendItems,
  trendsLoading,
  onTrendAnalyze,
  showAnalysisUI,
  aiSignals,
  className,
}: {
  trendCountry: CountryChipCode
  onTrendCountryChange: (code: CountryChipCode) => void
  trendItems: TrendItem[]
  trendsLoading: boolean
  onTrendAnalyze: (item: TrendItem) => void
  showAnalysisUI: boolean
  aiSignals: AiSignalCard[]
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5', className)}>
      <DashboardRisingTrendsPanel
        trendCountry={trendCountry}
        onTrendCountryChange={onTrendCountryChange}
        trendItems={trendItems}
        trendsLoading={trendsLoading}
        onTrendAnalyze={onTrendAnalyze}
        showAnalysisUI={showAnalysisUI}
      />
      <DashboardAiSignalsPanel aiSignals={aiSignals} />
    </div>
  )
}
