'use client'

import { cn } from '@/lib/utils'
import { chartAxisMuted, chartFontFamily, formatChartInt } from '@/lib/chartTheme'

type Segment = { label: string; start: number; end: number }

const BASE_FILL = '#5B7CFA'
const POS = '#0D9F6E'
const NEG = '#EF4444'
const FINAL_FILL = '#1B64DA'
const FINAL_STROKE = '#1547A8'

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

  const w = 720
  const h = 140
  const padL = 8
  const padR = 8
  const padB = 30
  const padT = 6
  const plotW = w - padL - padR
  const plotH = h - padT - padB
  const maxY = 100
  const yAt = (v: number) => padT + plotH - (v / maxY) * plotH

  const n = segments.length
  const gap = 5
  const totalUnits = (n - 1) + 1.5
  const unit = (plotW - gap * Math.max(0, n - 1)) / totalUnits

  let x = padL
  const layouts = segments.map((s, i) => {
    const isLast = i === n - 1
    const bw = isLast ? unit * 1.5 : unit
    const layout = { s, i, x, bw, isLast }
    x += bw + (i < n - 1 ? gap : 0)
    return layout
  })

  const MIN_FLOAT_H = 18

  return (
    <div className={cn('w-full max-w-none', className)} style={{ fontFamily: chartFontFamily }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[140px] w-full" preserveAspectRatio="xMidYMid meet" aria-label="시장 잠재력 워터폴">
        <line x1={padL} y1={yAt(0)} x2={w - padR} y2={yAt(0)} stroke="#E5E8EF" strokeWidth={1} className="dark:stroke-zinc-700" />
        {layouts.map(({ s, i, x: bx, bw, isLast }) => {
          const y0 = yAt(s.start)
          const y1 = yAt(s.end)
          const top = Math.min(y0, y1)
          const rawH = Math.abs(y1 - y0)
          const delta = s.end - s.start
          let hRect = Math.max(2, rawH)
          let yRect = top
          if (i > 0 && delta !== 0 && rawH < MIN_FLOAT_H) {
            hRect = MIN_FLOAT_H
            yRect = Math.max(yAt(s.start), yAt(s.end)) - hRect
          }
          const fill =
            isLast && segments.length > 1
              ? FINAL_FILL
              : i === 0
                ? BASE_FILL
                : delta >= 0
                  ? POS
                  : NEG
          const stroke = isLast && segments.length > 1 ? FINAL_STROKE : fill
          const showDeltaInside = i > 0 && !isLast && Math.abs(delta) >= 0.5 && hRect >= 14 && bw >= 22
          const showFinalInside = isLast && segments.length > 1 && hRect >= 16

          return (
            <g key={`${s.label}-${i}`}>
              {i > 0 ? (
                <path
                  d={`M ${layouts[i - 1]!.x + layouts[i - 1]!.bw} ${yAt(layouts[i - 1]!.s.end)} L ${bx} ${yAt(layouts[i - 1]!.s.end)}`}
                  stroke={chartAxisMuted}
                  strokeWidth={1.1}
                  strokeOpacity={0.55}
                  fill="none"
                />
              ) : null}
              <rect
                x={bx}
                y={yRect}
                width={bw}
                height={hRect}
                rx={isLast ? 5 : 4}
                fill={fill}
                stroke={stroke}
                strokeWidth={isLast ? 2 : 1}
                strokeOpacity={isLast ? 1 : 0.35}
              />
              {showDeltaInside ? (
                <text
                  x={bx + bw / 2}
                  y={yRect + hRect / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={700}
                  fill="#fff"
                  className="select-none"
                >
                  {delta > 0 ? '+' : ''}
                  {formatChartInt(Math.round(delta))}
                </text>
              ) : null}
              {showFinalInside ? (
                <text
                  x={bx + bw / 2}
                  y={yRect + hRect / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={800}
                  fill="#fff"
                  className="select-none"
                >
                  {formatChartInt(Math.round(s.end))}
                </text>
              ) : null}
              <text x={bx + bw / 2} y={h - 7} fontSize={9} fill={chartAxisMuted} textAnchor="middle" className="select-none">
                {s.label.length > 9 ? `${s.label.slice(0, 8)}…` : s.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
