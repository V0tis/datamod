'use client'

import { useEffect } from 'react'
import { useResearchStore } from '@/lib/stores/research-store'
import { isAnalyzing } from '@/lib/types/analysis-modes'

/**
 * persist(skipHydration) 복원: 서버 HTML과 첫 클라이언트 렌더를 맞춘 뒤 localStorage를 병합합니다.
 */
export function ResearchStoreRehydrate() {
  useEffect(() => {
    void useResearchStore.persist.rehydrate()
  }, [])

  useEffect(() => {
    const flush = () => {
      try {
        const s = useResearchStore.getState()
        if (s.status !== 'loading' || !isAnalyzing(s.streamingState)) return
        const snap = {
          v: 1,
          at: Date.now(),
          keyword: s.keyword,
          analysisId: s.analysisId,
          stepId:
            s.streamingState.status === 'running' || s.streamingState.status === 'streaming'
              ? s.streamingState.stepId
              : null,
          currentStep: s.currentStep,
        }
        localStorage.setItem('rin_datamod_stream_ckpt_v1', JSON.stringify(snap))
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('beforeunload', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  return null
}
