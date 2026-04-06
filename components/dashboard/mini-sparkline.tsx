'use client'

import { ResponsiveContainer, LineChart, Line } from 'recharts'

const TONE_STROKE: Record<'blue' | 'emerald' | 'red' | 'mint', string> = {
  blue: '#2563eb',
  emerald: '#059669',
  red: '#dc2626',
  mint: '#2AC1BC',
}

/** 목록 카드·KPI용 미니 추세선 (장식용 시계열) */
export function MiniSparkline({
  seed,
  tone = 'blue',
  className,
}: {
  seed: number
  tone?: keyof typeof TONE_STROKE
  className?: string
}) {
  const pts = [0, 1, 2, 3, 4, 5].map((i) => ({
    i,
    v: 22 + ((seed * 13 + i * 17) % 38),
  }))
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
