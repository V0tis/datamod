'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { cn } from '@/lib/utils'

const CX = 100
const CY = 100
const R = 88
const STROKE = 2.5
const KNOB_R = 6

/** -100 ~ 100 감성 점수에 따른 라벨 */
function getSentimentLabel(score: number): string {
  if (score > 60) return '매우 긍정'
  if (score > 30) return '긍정'
  if (score >= -30) return '중립'
  if (score >= -60) return '부정'
  return '매우 부정'
}

/** -100 ~ 100 감성 점수에 따른 색상 (Dashlite 미니멀) */
function getSentimentColor(score: number): string {
  if (score > 30) return '#34d399' // emerald-400
  if (score >= -30) return '#fbbf24' // amber-400
  return '#fb7185' // rose-400
}

/** 반원 arc path (180° → 0°, 상단 호) */
function getSemicirclePath(cx: number, cy: number, r: number): string {
  const x0 = cx - r
  const x1 = cx + r
  return `M ${x0} ${cy} A ${r} ${r} 0 0 0 ${x1} ${cy}`
}

/** value(-100~100)에 해당하는 호 끝 각도(도). 180 = 왼쪽, 0 = 오른쪽 */
function valueToAngle(value: number): number {
  return 180 - ((value + 100) / 200) * 180
}

/** 각도(도) → 호 위의 점 (cx, cy 기준, 반지름 r) */
function angleToPoint(angleDeg: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  }
}

const SEMICIRCLE_LENGTH = Math.PI * R

export interface SentimentGaugeProps {
  /** -100 ~ 100 감성 점수 */
  value: number
  className?: string
}

export function SentimentGauge({ value, className }: SentimentGaugeProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [totalLength, setTotalLength] = useState(SEMICIRCLE_LENGTH)
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength()
      setTotalLength(len)
    }
  }, [])

  useEffect(() => {
    const clamped = Math.max(-100, Math.min(100, value))
    const controls = animate(0, clamped, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayValue(v),
    })
    return () => controls.stop()
  }, [value])

  const fillLength = ((displayValue + 100) / 200) * totalLength
  const dashOffset = totalLength - fillLength
  const angle = valueToAngle(displayValue)
  const knobPos = angleToPoint(angle, CX, CY, R)
  const color = getSentimentColor(displayValue)
  const label = getSentimentLabel(Math.round(displayValue))

  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <svg
        viewBox="0 0 200 120"
        className="w-full max-w-[200px] h-auto"
        style={{ overflow: 'visible' }}
      >
        {/* 트랙: 얇은 반원 */}
        <path
          d={getSemicirclePath(CX, CY, R)}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-zinc-700"
        />
        {/* 채워지는 호: 0 → value 애니메이션 */}
        <path
          ref={pathRef}
          d={getSemicirclePath(CX, CY, R)}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={totalLength}
          strokeDashoffset={dashOffset}
        />
        {/* 현재 점수 위치 노브 */}
        <circle
          cx={knobPos.x}
          cy={knobPos.y}
          r={KNOB_R}
          fill={color}
          className="opacity-95"
        />
      </svg>
      <div className="mt-1 text-center">
        <span className="text-xl font-semibold tabular-nums text-[#e1e3e6]">
          {Math.round(displayValue)}
        </span>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
