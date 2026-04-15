'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * `/results`에서 `main` 스크롤이 threshold를 넘으면 true.
 * 글로벌 상단 네비를 숨기고 리포트 탭만 두는 데 사용.
 */
export function useResultsMainScrolledPast(threshold = 28): boolean {
  const pathname = usePathname()
  const isResults = pathname?.startsWith('/results') ?? false
  const [past, setPast] = useState(false)

  useEffect(() => {
    if (!isResults) {
      setPast(false)
      return
    }
    const main = document.querySelector('main')
    if (!main) return
    const run = () => setPast(main.scrollTop > threshold)
    run()
    main.addEventListener('scroll', run, { passive: true })
    return () => main.removeEventListener('scroll', run)
  }, [isResults, threshold])

  return past
}
