'use client'

import { cn } from '@/lib/utils'
import { chartAxisMuted, chartFontFamily, formatChartInt } from '@/lib/chartTheme'

export type WaterfallSegment = {
  label: string
  start: number
  end: number
  kind: 'total' | 'floating' | 'final'
}

const TRACK = '#E5E8EF'
const BASE_FILL = '#5B7CFA'
const POS = '#0D9F6E'
const NEG = '#EF4444'
const FINAL_FILL = '#1B64DA'
const FINAL_STROKE = '#1547A8'

function yScale(v: number, padT: number, plotH: number, maxY: number): number {
  return padT + plotH - (v / maxY) * plotH
}

/** 누적 0~100 스케일 워터폴 — 동일 막대 너비, 최종 막대만 1.5배, 커넥터 포함 */
export function OpportunityWaterfallSvg({
  segments,
  finalLabel = '최종 점수',
  className,
  height = 140,
}: {
  segments: WaterfallSegment[]
  finalLabel?: string
  className?: string
  height?: number
}) {
  const w = 720
  const padL = 8
  const padR = 8
  const padB = 34
  const padT = 6
  const plotW = w - padL - padR
  const plotH = height - padT - padB
  const maxY = 100

  const n = segments.length
  if (n === 0) return null

  const gap = 5
  const totalUnits = (n - 1) + 1.5
  const unit = (plotW - gap * Math.max(0, n - 1)) / totalUnits

  let x = padL
  const barLayouts = segments.map((s, i) => {
    const isLast = i === n - 1
    const bw = isLast ? unit * 1.5 : unit
    const layout = { ...s, x, bw, i }
    x += bw + (i < n - 1 ? gap : 0)
    return layout
  })

  const yAt = (v: number) => yScale(v, padT, plotH, maxY)

  return (
    <div className={cn('w-full', className)} style={{ fontFamily: chartFontFamily }}>
      <svg
        viewBox={`0 0 ${w} ${height}`}
        className="h-auto w-full min-h-[120px]"
        preserveAspectRatio="xMidYMid meet"
        aria-label="기회 점수 분해 워터폴"
      >
        <line x1={padL} y1={yAt(0)} x2={w - padR} y2={yAt(0)} stroke={TRACK} strokeWidth={1} opacity={0.95} />
        {barLayouts.map((b, idx) => {
          const y0 = yAt(b.start)
          const y1 = yAt(b.end)
          const top = Math.min(y0, y1)
          const hRect = Math.max(2, Math.abs(y1 - y0))
          const fill =
            b.kind === 'final'
              ? FINAL_FILL
              : b.kind === 'total'
                ? BASE_FILL
                : b.end >= b.start
                  ? POS
                  : NEG
          const stroke = b.kind === 'final' ? FINAL_STROKE : fill
          const delta = b.end - b.start
          const showDeltaInside = b.kind === 'floating' && Math.abs(delta) >= 0.5 && hRect >= 14 && b.bw >= 24
          const label = b.kind === 'final' ? finalLabel : b.label

          return (
            <g key={`${b.label}-${idx}`}>
              {idx > 0 ? (
                <path
                  d={`M ${barLayouts[idx - 1].x + barLayouts[idx - 1].bw} ${yAt(barLayouts[idx - 1].end)} L ${b.x} ${yAt(barLayouts[idx - 1].end)}`}
                  stroke={chartAxisMuted}
                  strokeWidth={1.1}
                  strokeOpacity={0.55}
                  fill="none"
                />
              ) : null}
              <rect
                x={b.x}
                y={top}
                width={b.bw}
                height={hRect}
                rx={b.kind === 'final' ? 5 : 4}
                fill={fill}
                stroke={stroke}
                strokeWidth={b.kind === 'final' ? 2 : 1}
                strokeOpacity={b.kind === 'final' ? 1 : 0.35}
              />
              {showDeltaInside ? (
                <text
                  x={b.x + b.bw / 2}
                  y={top + hRect / 2}
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
              {b.kind === 'final' ? (
                <text
                  x={b.x + b.bw / 2}
                  y={top + hRect / 2}
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontSize={14}
                  fontWeight={800}
                  fill="#fff"
                  className="select-none"
                >
                  {formatChartInt(Math.round(b.end))}
                </text>
              ) : null}
              <text x={b.x + b.bw / 2} y={height - 8} fontSize={10} fill={chartAxisMuted} textAnchor="middle" className="select-none">
                {label.length > 9 ? `${label.slice(0, 8)}…` : label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
