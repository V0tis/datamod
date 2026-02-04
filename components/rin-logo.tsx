'use client'

import { RinAnimation } from '@/components/common/RinAnimation'

/**
 * 린(Rin) 앱 로고 - applogo.json Lottie 애니메이션 사용
 */
interface RinLogoProps {
  className?: string
  size?: number
}

export function RinLogo({ className = '', size = 40 }: RinLogoProps) {
  return (
    <RinAnimation
      variant="logo"
      size={size}
      className={className}
      loop={true}
    />
  )
}
