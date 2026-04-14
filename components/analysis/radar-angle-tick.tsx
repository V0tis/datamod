'use client'

/** Recharts PolarAngleAxis tick: 긴 레이블은 말줄임, 전체 문구는 title(호버)로 제공 */
export function RadarAngleEllipsisTick(props: {
  x?: number
  y?: number
  payload?: { value?: unknown }
  textAnchor?: string
  className?: string
  fill?: string
  maxLen?: number
  /** 기본 10. 좁은 카드에서는 11px급으로 통일 가능 */
  fontSize?: number
}) {
  const { x = 0, y = 0, payload, textAnchor = 'middle', fill = '#64748b', maxLen = 9, fontSize = 10 } = props
  const full = String(payload?.value ?? '')
  const short = full.length > maxLen ? `${full.slice(0, maxLen)}…` : full
  return (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor as 'start' | 'middle' | 'end'}
      fill={fill}
      fontSize={fontSize}
      className={props.className}
    >
      <title>{full}</title>
      {short}
    </text>
  )
}
