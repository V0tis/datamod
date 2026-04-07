'use client'

import { useEffect } from 'react'
import { useResearchStore } from '@/lib/stores/research-store'

/**
 * persist(skipHydration) 복원: 서버 HTML과 첫 클라이언트 렌더를 맞춘 뒤 localStorage를 병합합니다.
 */
export function ResearchStoreRehydrate() {
  useEffect(() => {
    void useResearchStore.persist.rehydrate()
  }, [])

  return null
}
