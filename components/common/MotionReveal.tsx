'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

const ease = [0.22, 1, 0.36, 1] as const

export type MotionRevealProps = {
  children: ReactNode
  className?: string
  /** true면 등장 애니메이션 생략(로딩 중 등) */
  staticLayout?: boolean
  /** 순차 등장 시 지연(초) */
  delay?: number
}

/**
 * 대시보드 위젯·카드: 로딩이 끝난 뒤 한 번 부드럽게 올라오며 나타남.
 */
export function MotionReveal({ children, className, staticLayout = false, delay = 0 }: MotionRevealProps) {
  if (staticLayout) {
    return <div className={className}>{children}</div>
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease }}
    >
      {children}
    </motion.div>
  )
}
