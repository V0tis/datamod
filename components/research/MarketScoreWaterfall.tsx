'use client'

import { cn } from '@/lib/utils'
import { chartAxisMuted, chartColors, chartFontFamily, formatChartInt } from '@/lib/chartTheme'

type Segment = { label: string; start: number; end: number }

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

  const w = 360
  const h = 188
  const padL = 40
  const padR = 16
  const padB = 40
  const padT = 22
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const maxY = 100
  const yAt = (v: number) => padT + plotH - (v / maxY) * plotH
  const n = segments.length
  const gap = 8
  const barW = (plotW - gap * (n - 1)) / n

  const barFill = (i: number, delta: number) => {
    if (i === 0) return chartColors.primary
    if (delta >= 0) return chartColors.success
    return chartColors.danger
  }

  return (
    <div className={cn('w-full', className)} style={{ fontFamily: chartFontFamily }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full min-h-[220px] max-w-lg" aria-label="시장 잠재력 워터폴">
        <line x1={padL} y1={yAt(0)} x2={w - padR} y2={yAt(0)} stroke={chartAxisMuted} strokeOpacity={0.35} />
        {segments.map((s, i) => {
          const x = padL + i * (barW + gap)
          const yTop = yAt(s.end)
          const yBot = yAt(s.start)
          const bh = Math.max(4, yBot - yTop)
          const delta = s.end - s.start
          const fill = barFill(i, delta)
          const stroke = i === 0 ? chartColors.primary : fill
          const isLast = i === segments.length - 1
          const isFinalBar = isLast && segments.length > 1

          return (
            <g key={`${s.label}-${i}`}>
              {i > 0 ? (
                <path
                  d={`M ${padL + (i - 1) * (barW + gap) + barW} ${yAt(segments[i - 1].end)} L ${x} ${yAt(segments[i - 1].end)}`}
                  stroke={chartAxisMuted}
                  strokeWidth={1.25}
                  strokeDasharray="4 3"
                  fill="none"
                  opacity={0.85}
                />
              ) : null}
              <rect
                x={x}
                y={yTop}
                width={barW}
                height={bh}
                rx={5}
                fill={fill}
                stroke={stroke}
                strokeOpacity={isFinalBar ? 0.95 : 0.22}
                strokeWidth={isFinalBar ? 3 : 1}
                fillOpacity={isFinalBar ? 1 : 0.95}
              />
              {delta !== 0 && i > 0 ? (
                <text
                  x={x + barW / 2}
                  y={yTop + bh / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#fff"
                  className="select-none"
                >
                  {delta > 0 ? '+' : ''}
                  {formatChartInt(delta)}
                </text>
              ) : null}
              <text x={x + barW / 2} y={h - 12} fontSize={10} fill={chartAxisMuted} textAnchor="middle" className="select-none">
                {s.label}
              </text>
              <text x={x + barW / 2} y={yTop - 5} fontSize={10} fill={chartAxisMuted} textAnchor="middle">
                {formatChartInt(Math.round(s.end))}
              </text>
              {!isLast ? (
                <line
                  x1={x + barW}
                  y1={yAt(s.end)}
                  x2={x + barW + gap}
                  y2={yAt(s.end)}
                  stroke={chartAxisMuted}
                  strokeWidth={1.5}
                  strokeOpacity={0.55}
                />
              ) : null}
            </g>
          )
        })}
        <text x={padL} y={14} fontSize={10} fill={chartAxisMuted}>
          누적 흐름 → 목표 {formatChartInt(final)}
        </text>
      </svg>
    </div>
  )
}
