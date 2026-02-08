'use client'

import { create } from 'zustand'
import type { FormattedErrorDetail } from '@/lib/error-handler'

interface ErrorDetailState {
  detail: FormattedErrorDetail | null
  errorId: string | null
  setDetail: (d: FormattedErrorDetail | null) => void
  openDetail: (d: FormattedErrorDetail) => void
  closeDetail: () => void
}

/** 프로덕션에서 로그 추적용으로만 사용하는 짧은 ID */
function generateErrorId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useErrorDetailStore = create<ErrorDetailState>((set) => ({
  detail: null,
  errorId: null,
  setDetail: (d) => set({ detail: d, errorId: d ? generateErrorId() : null }),
  openDetail: (d) => set({ detail: d, errorId: generateErrorId() }),
  closeDetail: () => set({ detail: null, errorId: null }),
}))
