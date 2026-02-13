'use client'

import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'
import { cn } from '@/lib/utils'

const CX = 100
const CY = 100
const R = 88
/** 스트로크 두께 1.5배: 2.5 * 1.5 = 3.75 */
const STROKE = 3.75
/** 니들(포인터) 길이: 호 끝까지 닿도록 */
const NEEDLE_LENGTH = R - 4

/** -100 ~ 100 감성 점수에 따른 라벨 */
function getSentimentLabel(score: number): string {
  if (score > 60) return '매우 긍정'
  if (score > 30) return '긍정'
  if (score >= -30) return '중립'
  if (score >= -60) return '부정'
  return '매우 부정'
}

/** 음수 → Rose-500, 양수 → Emerald-500, 0 → Slate */
function getSentimentColor(score: number): string {
  if (score < 0) return '#f43f5e' // rose-500
  if (score > 0) return '#10b981' // emerald-500
  return '#64748b' // slate-500
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
  const needleTip = angleToPoint(angle, CX, CY, NEEDLE_LENGTH)
  const color = getSentimentColor(displayValue)
  const label = getSentimentLabel(Math.round(displayValue))

  return (
    <div className={cn('flex flex-col items-center justify-center gap-0', className)}>
      <svg
        viewBox="0 0 200 120"
        className="w-full max-w-[200px] h-auto"
        style={{ overflow: 'visible' }}
      >
        {/* 트랙: 반원 (두께 1.5배) */}
        <path
          d={getSemicirclePath(CX, CY, R)}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-zinc-700"
        />
        {/* 채워지는 호 */}
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
        {/* 현재 점수 위치 포인터(니들): 중심 → 호 위 점 */}
        <line
          x1={CX}
          y1={CY}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      {/* 점수와 라벨 수직 중앙 정렬 */}
      <div className="flex flex-col items-center justify-center text-center mt-0.5">
        <span
          className="text-xl font-bold tabular-nums text-[#e1e3e6] leading-tight"
          style={{ color: displayValue < 0 ? '#f43f5e' : displayValue > 0 ? '#10b981' : '#94a3b8' }}
        >
          {Math.round(displayValue)}
        </span>
        <p className="text-xs text-slate-400 mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  )
}
