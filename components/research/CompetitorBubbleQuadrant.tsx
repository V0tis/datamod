'use client'

import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT } from '@/lib/chart-theme'
import { ChartWithInsight } from '@/components/research/ChartWithInsight'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import {
  type CompetitorScatterRow,
  type ScatterPayload,
  toScatterPayload,
} from '@/lib/competitor-bubble-data'

function BubbleTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as (ScatterPayload & { size: number; tier: string }) | undefined
  if (!row) return null
  return (
    <div className="max-w-[280px] rounded-xl border border-border/70 bg-background/95 px-3 py-2.5 text-xs shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold text-foreground">{row.name}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">
        시장 점유·존재감 {row.x.toFixed(1)} · 기술·성장성 {row.y.toFixed(1)}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">버블 크기 ≈ 상대적 기업 규모 (데이터 기반 추정)</p>
      {row.positioning ? (
        <p className="mt-2 leading-relaxed text-foreground/90">{row.positioning}</p>
      ) : null}
    </div>
  )
}

export function CompetitorBubbleQuadrant({
  competitors,
  className,
}: {
  competitors: CompetitorScatterRow[]
  className?: string
}) {
  if (!competitors.length) return null
  const data = toScatterPayload(competitors)

  return (
    <ChartWithInsight
      title="경쟁사 버블 매트릭스"
      insight="X축은 시장 점유·존재감(1–10), Y축은 기술력·성장성(1–10), 버블 크기는 상대적 기업 규모를 나타냅니다. 티어(리더·도전자 등)는 색으로 구분됩니다."
      className={className}
    >
      <div className="rounded-2xl border border-slate-100 bg-muted/15 px-2 py-4 sm:px-4 dark:border-zinc-800">
        <div className="h-[min(400px,58vw)] w-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 44 }}>
              <CartesianGrid stroke={CHART_GRAY_GRID} strokeDasharray="4 4" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[1, 10]}
                ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }}
                tickLine={false}
                axisLine={{ stroke: CHART_GRAY_AXIS, strokeOpacity: 0.5 }}
                label={{
                  value: '시장 점유율 · 존재감 (1–10)',
                  position: 'bottom',
                  offset: 28,
                  fill: CHART_GRAY_AXIS,
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[1, 10]}
                ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }}
                tickLine={false}
                axisLine={{ stroke: CHART_GRAY_AXIS, strokeOpacity: 0.5 }}
                label={{
                  value: '기술력 · 성장성 (1–10)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 4,
                  fill: CHART_GRAY_AXIS,
                  fontSize: 11,
                }}
              />
              <ReferenceLine x={5} stroke={CHART_GRAY_AXIS} strokeDasharray="5 5" strokeOpacity={0.55} />
              <ReferenceLine y={5} stroke={CHART_GRAY_AXIS} strokeDasharray="5 5" strokeOpacity={0.55} />
              <Tooltip cursor={{ strokeDasharray: '4 4' }} content={<BubbleTooltip />} />
              <Scatter
                name="경쟁사"
                data={data}
                fill={CHART_MINT}
                isAnimationActive
                animationDuration={600}
                shape={(props: unknown) => {
                  const p = props as Record<string, unknown>
                  const cx = Number(p.cx ?? 0)
                  const cy = Number(p.cy ?? 0)
                  const payload = p.payload as ScatterPayload
                  const r = Math.max(6, Math.min(22, ((payload?.size ?? 60) / 120) * 18 + 6))
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={payload?.fill ?? CHART_MINT}
                      fillOpacity={0.9}
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  )
                }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <ChartSourceFooter className="px-1" />
      </div>
    </ChartWithInsight>
  )
}
