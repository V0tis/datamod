'use client'

import Lottie from 'lottie-react'
import { useEffect, useState } from 'react'

export const RIN_LOADING_MESSAGES = [
  '린이 뉴스를 킁킁거리고 있어요!',
  '중요한 정보를 입에 물고 오는 중...',
  '린이 뉴스를 물어오고 있어요...',
  '신선한 소식 찾아오는 중!',
  '킁킁, 좋은 걸 찾았어요!',
  '곧 물어올게요, 잠시만요~',
] as const

export function getRandomRinMessage(): string {
  return RIN_LOADING_MESSAGES[Math.floor(Math.random() * RIN_LOADING_MESSAGES.length)]
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
