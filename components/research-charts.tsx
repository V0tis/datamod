'use client'

import { DonutChart, Legend } from '@tremor/react'
import type { ChartData } from '@/lib/stores/research-store'

/** 감성 도넛: 긍정=emerald-500, 중립=slate-400, 부정=rose-500 */
const SENTIMENT_COLORS = ['emerald-500', 'slate-400', 'rose-500'] as const
const SENTIMENT_CATEGORIES = ['긍정', '중립', '부정'] as const

interface ResearchChartsProps {
  chartData: ChartData
}

export function ResearchCharts({ chartData }: ResearchChartsProps) {
  const totalSentiment =
    chartData.sentiment.positive + chartData.sentiment.neutral + chartData.sentiment.negative
  const donutData = [
    { name: '긍정', value: chartData.sentiment.positive },
    { name: '중립', value: chartData.sentiment.neutral },
    { name: '부정', value: chartData.sentiment.negative },
  ].filter((d) => d.value > 0)

  const valueFormatter = (v: number) => {
    if (totalSentiment <= 0) return '0%'
    return `${Math.round((v / totalSentiment) * 100)}%`
  }

  return (
    <div className="space-y-6 antialiased">
      {/* 감성 분석: Tremor DonutChart + 중앙 텍스트 오버레이 + Legend */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-4 antialiased">
          감성 분석 (긍정 / 중립 / 부정)
        </h3>
        <div className="relative flex flex-col items-center min-h-[220px] w-full">
          {donutData.length > 0 ? (
            <>
              <div className="relative w-full max-w-[220px] h-[220px] flex items-center justify-center">
                <DonutChart
                  data={donutData}
                  category="value"
                  index="name"
                  variant="donut"
                  colors={[...SENTIMENT_COLORS]}
                  valueFormatter={valueFormatter}
                  showLabel={false}
                  showTooltip
                  showAnimation
                  animationDuration={400}
                  className="w-full h-full"
                />
                {/* 중앙 텍스트: 선명한 숫자, 상하 정렬 */}
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  aria-hidden
                >
                  <span className="fill-white text-2xl font-bold text-white antialiased tabular-nums">
                    {totalSentiment}
                  </span>
                </div>
              </div>
              <Legend
                categories={[...SENTIMENT_CATEGORIES]}
                colors={[...SENTIMENT_COLORS]}
                className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 antialiased"
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] w-full rounded-lg border border-dashed border-slate-700 text-slate-400 text-sm antialiased">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 pt-1 antialiased">
        ※ 본 지표는 AI가 수집된 뉴스를 분석하여 생성한 추정치입니다.
      </p>
    </div>
  )
}
