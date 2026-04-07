'use client'

import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  Customized,
  ReferenceArea,
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

export type CompetitorScatterRow = {
  name?: string
  positioning?: string
  target_market?: string
  market_presence?: number
  innovation_level?: number
  key_feature?: string
  pricing?: string
  differentiation?: string
}

type ScatterPayload = {
  x: number
  y: number
  name: string
  positioning?: string
  differentiation?: string
  inferred?: boolean
}

function clamp1to10(n: number): number {
  return Math.min(10, Math.max(1, Math.round(n)))
}

/** 레거시/누락 점수용: 텍스트·가격 휴리스틱 → 1~10 스케일 */
function heuristicXY(c: CompetitorScatterRow, i: number): { x: number; y: number } {
  const pricing = `${c.pricing ?? ''}`.toLowerCase()
  const pos = `${c.positioning ?? ''} ${c.target_market ?? ''}`.toLowerCase()
  const diff = `${c.differentiation ?? ''} ${c.key_feature ?? ''}`
  let x = 5
  if (/무료|freemium|저가|low\s*cost|저렴|low\s*price/.test(pricing)) x = 3
  else if (/프리미엄|고가|premium|enterprise|엔터프라이즈|상위/.test(pricing)) x = 8
  else if (/중간|mid|중저가/.test(pricing)) x = 5
  let y = 5
  const diffLen = diff.trim().length
  y = Math.min(9, Math.max(2, 4 + Math.min(4, diffLen * 0.12)))
  if (/니치|특화|차별|독점|only|unique|vertical/.test(pos + diff)) y = Math.min(10, y + 1)
  if (/범용|플랫폼|종합|horizontal|suite|all-in-one/.test(pos + diff)) y = Math.max(2, y - 1)
  x += ((i * 11) % 7) - 3
  y += ((i * 13) % 5) - 2
  return { x: clamp1to10(x), y: clamp1to10(y) }
}

function toScatterPayload(competitors: CompetitorScatterRow[]): ScatterPayload[] {
  const used = new Map<string, number>()
  return competitors.slice(0, 12).map((c, i) => {
    const name = (c.name && String(c.name).trim()) || `경쟁사 ${i + 1}`
    const mp = c.market_presence
    const il = c.innovation_level
    const hasMp = typeof mp === 'number' && Number.isFinite(mp)
    const hasIl = typeof il === 'number' && Number.isFinite(il)
    let x: number
    let y: number
    let inferred = false
    if (hasMp && hasIl) {
      x = clamp1to10(mp!)
      y = clamp1to10(il!)
    } else if (hasMp) {
      x = clamp1to10(mp!)
      const h = heuristicXY(c, i)
      y = h.y
      inferred = true
    } else if (hasIl) {
      const h = heuristicXY(c, i)
      x = h.x
      y = clamp1to10(il!)
      inferred = true
    } else {
      const h = heuristicXY(c, i)
      x = h.x
      y = h.y
      inferred = true
    }
    const key = `${x},${y}`
    const n = (used.get(key) ?? 0) + 1
    used.set(key, n)
    if (n > 1) {
      const bump = (n - 1) * 0.22
      x = Math.min(10, x + bump)
      y = Math.min(10, y + bump * 0.65)
      inferred = true
    }
    return {
      x,
      y,
      name,
      positioning: typeof c.positioning === 'string' ? c.positioning.trim() : undefined,
      differentiation: typeof c.differentiation === 'string' ? c.differentiation.trim() : undefined,
      inferred,
    }
  })
}

type ChartOffsetLite = { left: number; top: number; width: number; height: number }

function QuadrantLabelsFromChart(props: { offset?: ChartOffsetLite }) {
  return <QuadrantLabels offset={props.offset} />
}

function QuadrantLabels(props: { offset?: ChartOffsetLite }) {
  const { offset } = props
  if (!offset?.width) return null
  const { left, top, width, height } = offset
  const labels: { x: number; y: number; en: string; ko: string }[] = [
    { x: 0.22, y: 0.76, en: 'Niche', ko: '틈새' },
    { x: 0.78, y: 0.76, en: 'Challengers', ko: '도전자' },
    { x: 0.22, y: 0.28, en: 'Visionaries', ko: '비전형' },
    { x: 0.78, y: 0.28, en: 'Leaders', ko: '리더' },
  ]
  return (
    <g aria-hidden>
      {labels.map(({ x: fx, y: fy, en, ko }) => (
        <text
          key={en}
          x={left + width * fx}
          y={top + height * fy}
          fill={CHART_GRAY_AXIS}
          fillOpacity={0.38}
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          className="select-none"
        >
          {`${en} · ${ko}`}
        </text>
      ))}
    </g>
  )
}

function CompetitorScatterTooltip({
  active,
  payload,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as ScatterPayload | undefined
  if (!row) return null
  return (
    <div className="max-w-[280px] rounded-2xl border border-border/70 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="text-sm font-semibold text-foreground">{row.name}</p>
      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
        시장 존재감 {row.x.toFixed(1)} · 혁신 {row.y.toFixed(1)}
        {row.inferred ? (
          <span className="ml-1 text-amber-600/90 dark:text-amber-400/90">(일부 추정)</span>
        ) : null}
      </p>
      {row.positioning ? (
        <p className="mt-2 text-xs leading-relaxed text-foreground/90">
          <span className="font-medium text-muted-foreground">포지셔닝 </span>
          {row.positioning}
        </p>
      ) : null}
      {row.differentiation ? (
        <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">
          <span className="font-medium text-muted-foreground">차별화 </span>
          {row.differentiation}
        </p>
      ) : null}
    </div>
  )
}

export function CompetitorPositioningScatter({
  competitors,
  className,
}: {
  competitors: CompetitorScatterRow[]
  className?: string
}) {
  if (!competitors.length) return null
  const data = toScatterPayload(competitors)
  const hasAllScores = competitors.every(
    (c) =>
      typeof c.market_presence === 'number' &&
      Number.isFinite(c.market_presence) &&
      typeof c.innovation_level === 'number' &&
      Number.isFinite(c.innovation_level)
  )

  return (
    <ChartWithInsight
      title="경쟁사 포지셔닝 맵"
      insight={
        hasAllScores
          ? 'X축은 시장 존재감·인지도(1–10), Y축은 기술·제품 혁신성(1–10)입니다. 중앙(5,5) 기준 네 사분면으로 해석합니다.'
          : '일부 경쟁사는 점수가 없어 텍스트·가격 정보로 위치를 보완했습니다. 새 분석에서는 market_presence·innovation_level이 모두 채워집니다.'
      }
      className={className}
    >
      <div className="rounded-2xl bg-muted/20 px-2 py-4 sm:px-4 sm:py-6">
        <div className="h-[min(360px,55vw)] w-full min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 16, right: 20, left: 8, bottom: 36 }}>
              {/* 4사분면 배경 (아주 연한 톤) */}
              <ReferenceArea x1={1} x2={5} y1={1} y2={5} fill="#64748b" fillOpacity={0.045} strokeOpacity={0} />
              <ReferenceArea x1={5} x2={10} y1={1} y2={5} fill="#3b82f6" fillOpacity={0.04} strokeOpacity={0} />
              <ReferenceArea x1={1} x2={5} y1={5} y2={10} fill="#8b5cf6" fillOpacity={0.04} strokeOpacity={0} />
              <ReferenceArea x1={5} x2={10} y1={5} y2={10} fill={CHART_MINT} fillOpacity={0.07} strokeOpacity={0} />
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
                  value: '시장 존재감 · 인지도 (1–10)',
                  position: 'bottom',
                  offset: 18,
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
                  value: '혁신 수준 (1–10)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 6,
                  fill: CHART_GRAY_AXIS,
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                x={5}
                stroke={CHART_GRAY_AXIS}
                strokeDasharray="5 5"
                strokeOpacity={0.65}
                strokeWidth={1}
              />
              <ReferenceLine
                y={5}
                stroke={CHART_GRAY_AXIS}
                strokeDasharray="5 5"
                strokeOpacity={0.65}
                strokeWidth={1}
              />
              <Customized component={QuadrantLabelsFromChart} />
              <Tooltip
                cursor={{ strokeDasharray: '4 4', stroke: CHART_MINT, strokeWidth: 1 }}
                content={<CompetitorScatterTooltip />}
              />
              <Scatter
                name="경쟁사"
                data={data}
                fill={CHART_MINT}
                fillOpacity={0.92}
                stroke="#fff"
                strokeWidth={2}
                r={9}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-4 px-1 text-center text-[10px] leading-relaxed text-muted-foreground/80">
          좌하 Niche · 우하 Challengers · 좌상 Visionaries · 우상 Leaders (중앙 기준 5)
        </p>
      </div>
    </ChartWithInsight>
  )
}
