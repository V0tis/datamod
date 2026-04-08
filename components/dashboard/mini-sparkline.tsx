'use client'

import { ResponsiveContainer, LineChart, Line } from 'recharts'

const TONE_STROKE: Record<'blue' | 'emerald' | 'red' | 'mint', string> = {
  blue: '#2563eb',
  emerald: '#059669',
  red: '#dc2626',
  mint: '#2AC1BC',
}

/** 목록 카드·KPI용 미니 추세선. `endValue`가 있으면 마지막 구간이 해당 점수(0–100)로 수렴합니다. */
export function MiniSparkline({
  seed,
  tone = 'blue',
  endValue,
  className,
}: {
  seed: number
  tone?: keyof typeof TONE_STROKE
  /** 0–100: 현재 점수 근처로 추세가 맞춰짐 */
  endValue?: number
  className?: string
}) {
  const target =
    endValue != null ? Math.max(8, Math.min(92, Math.round(endValue))) : null
  const pts = [0, 1, 2, 3, 4, 5].map((i) => {
    const base = 22 + ((seed * 13 + i * 17) % 38)
    if (target == null) return { i, v: base }
    const t = i / 5
    return { i, v: Math.round(base * (1 - t) + target * t) }
  })
  return (
    <div className={className ?? 'h-9 w-[72px] shrink-0 opacity-90'} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={TONE_STROKE[tone]}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
