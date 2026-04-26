'use client'

import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const enterS = 0.1
const exitS = 0.05

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        // 이전 화면 페이드아웃을 짧게: wait 모드에서 체감 "멈춤"을 줄임
        exit={{ opacity: 0, transition: { duration: exitS, ease: [0.4, 0, 1, 1] } }}
        transition={{ opacity: { duration: enterS, ease: [0.2, 0, 0, 1] } }}
        className="min-h-screen overflow-visible"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
