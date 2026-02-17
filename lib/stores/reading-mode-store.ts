'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** PM reading density: compact = scan more, focus = deep read with more spacing. */
export type ReadingMode = 'compact' | 'focus'

interface ReadingModeState {
  mode: ReadingMode
  setMode: (mode: ReadingMode) => void
}

export const useReadingModeStore = create<ReadingModeState>()(
  persist(
    (set) => ({
      mode: 'focus',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'rin-reading-mode' }
  )
)
