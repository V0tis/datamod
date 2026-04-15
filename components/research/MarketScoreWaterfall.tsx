'use client'

import { cn } from '@/lib/utils'
import { CHART_GRAY_AXIS } from '@/lib/chart-theme'

const BASE_FILL = '#2563eb'
const POS_FILL = '#3b82f6'
const NEG_FILL = '#ef4444'
const NEU_FILL = '#64748b'

type Segment = { label: string; start: number; end: number }

/** 기회 점수에 맞춘 단계별 누적(워터폴 스타일) 시각화 */
export function MarketScoreWaterfall({
  opportunityScore,
  marketGrowth = 0,
  trendMomentum = 0,
  className,
}: {
  opportunityScore: number
  marketGrowth?: number
  trendMomentum?: number
  className?: string
}) {
  const base = 50
  const mg = typeof marketGrowth === 'number' && Number.isFinite(marketGrowth) ? marketGrowth : 0
  const tm = typeof trendMomentum === 'number' && Number.isFinite(trendMomentum) ? trendMomentum : 0
  const d1 = Math.round(Math.min(18, Math.max(-12, mg * 0.35)))
  const d2 = Math.round(Math.min(15, Math.max(-10, tm * 0.28)))
  const final = Math.min(100, Math.max(0, opportunityScore))
  const d3 = Math.round(Math.min(25, Math.max(-22, final - base - d1 - d2)))
  const run = base + d1 + d2 + d3
  const adjust = final - run
  const segments: Segment[] = [
    { label: '기준선', start: 0, end: base },
    { label: '시장 성장', start: base, end: base + d1 },
    { label: '검색·트렌드', start: base + d1, end: base + d1 + d2 },
    { label: '기타 보정', start: base + d1 + d2, end: base + d1 + d2 + d3 },
  ]
  if (Math.abs(adjust) > 0.5) {
    segments.push({
      label: '최종 보정',
      start: base + d1 + d2 + d3,
      end: final,
    })
  }

  const w = 340
  const h = 168
  const padL = 36
  const padR = 12
  const padB = 36
  const padT = 20
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const maxY = 100
  const yAt = (v: number) => padT + plotH - (v / maxY) * plotH
  const n = segments.length
  const gap = 6
  const barW = (plotW - gap * (n - 1)) / n

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full max-w-lg" aria-label="시장 잠재력 워터폴">
        <line
          x1={padL}
          y1={yAt(0)}
          x2={w - padR}
          y2={yAt(0)}
          stroke={CHART_GRAY_AXIS}
          strokeOpacity={0.35}
        />
        {segments.map((s, i) => {
          const x = padL + i * (barW + gap)
          const yTop = yAt(s.end)
          const yBot = yAt(s.start)
          const bh = Math.max(3, yBot - yTop)
          const delta = s.end - s.start
          const fill =
            i === 0
              ? BASE_FILL
              : delta >= 0
                ? POS_FILL
                : NEG_FILL
          const stroke = i === 0 ? NEU_FILL : fill
          return (
            <g key={`${s.label}-${i}`}>
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={bh}
                rx={4}
                fill={fill}
                stroke={stroke}
                strokeOpacity={0.25}
                fillOpacity={0.92}
              />
              <text
                x={x + barW / 2}
                y={h - 10}
                fontSize={9}
                fill={CHART_GRAY_AXIS}
                textAnchor="middle"
                className="select-none"
              >
                {s.label}
              </text>
              <text x={x + barW / 2} y={yTop - 4} fontSize={9} fill={CHART_GRAY_AXIS} textAnchor="middle">
                {Math.round(s.end)}
              </text>
            </g>
          )
        })}
        <text x={padL} y={14} fontSize={10} fill={CHART_GRAY_AXIS}>
          잠재력 누적 → 목표 {final}
        </text>
      </svg>
    </div>
  )
}
