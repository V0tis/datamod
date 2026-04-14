'use client'

import Lottie from 'lottie-react'
import { useEffect, useState } from 'react'

export const RIN_LOADING_MESSAGES = [
  '분석을 준비하고 있습니다.',
  '뉴스와 데이터를 수집하는 중입니다.',
  '정보를 종합하는 중입니다.',
  '리포트를 생성하는 중입니다.',
  '잠시만 기다려 주세요.',
] as const

/** @deprecated 브랜드명 호환 — `DATAMOD_LOADING_MESSAGES` 사용 권장 */
export const DATAMOD_LOADING_MESSAGES = RIN_LOADING_MESSAGES

export function getRandomRinMessage(): string {
  return RIN_LOADING_MESSAGES[Math.floor(Math.random() * RIN_LOADING_MESSAGES.length)]
}

export function getRandomDatamodMessage(): string {
  return getRandomRinMessage()
}

type RinAnimationVariant = 'loading' | 'logo'

export interface RinAnimationProps {
  variant: RinAnimationVariant
  className?: string
  /** Width in pixels; height follows for square-ish look. Default: loading=280, logo=120 */
  size?: number
  loop?: boolean
}

const variantToPath: Record<RinAnimationVariant, string> = {
  loading: '/lottie/loading.json',
  logo: '/lottie/applogo.json',
}

const defaultSizes: Record<RinAnimationVariant, number> = {
  loading: 280,
  logo: 120,
}

export function RinAnimation({
  variant,
  className = '',
  size,
  loop = true,
}: RinAnimationProps) {
  const path = variantToPath[variant]
  const pixelSize = size ?? defaultSizes[variant]
  const [data, setData] = useState<object | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(path)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [path])

  if (!data) {
    return (
      <div
        className={className}
        style={{ width: pixelSize, height: pixelSize }}
        aria-hidden
      >
        <div className="w-full h-full rounded-full bg-primary/10 animate-pulse" />
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ width: pixelSize, height: pixelSize }}
      aria-hidden
    >
      <Lottie
        animationData={data}
        loop={loop}
        style={{ width: '100%', height: '100%' }}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }}
      />
    </div>
  )
}
