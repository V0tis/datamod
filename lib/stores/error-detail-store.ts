'use client'

import { create } from 'zustand'
import type { FormattedErrorDetail } from '@/lib/error-handler'

interface ErrorDetailState {
  detail: FormattedErrorDetail | null
  setDetail: (d: FormattedErrorDetail | null) => void
  openDetail: (d: FormattedErrorDetail) => void
  closeDetail: () => void
}

export const useErrorDetailStore = create<ErrorDetailState>((set) => ({
  detail: null,
  setDetail: (d) => set({ detail: d }),
  openDetail: (d) => set({ detail: d }),
  closeDetail: () => set({ detail: null }),
}))
