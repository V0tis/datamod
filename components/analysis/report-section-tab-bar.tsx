'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export const REPORT_SECTION_IDS = [
  'report-summary',
  'report-market',
  'report-competition',
  'report-insights',
  'report-strategic',
  'report-action',
] as const

const TAB_ITEMS: { id: (typeof REPORT_SECTION_IDS)[number]; label: string }[] = [
  { id: 'report-summary', label: '요약' },
  { id: 'report-market', label: '시장' },
  { id: 'report-competition', label: '경쟁' },
  { id: 'report-insights', label: '인사이트' },
  { id: 'report-strategic', label: '전략·GTM' },
  { id: 'report-action', label: '액션' },
]

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function ReportSectionTabBar({ className }: { className?: string }) {
  const [activeId, setActiveId] = useState<string>(REPORT_SECTION_IDS[0])

  const updateActive = useCallback(() => {
    const headerOffset = 112
    const y = window.scrollY + headerOffset
    let current: (typeof REPORT_SECTION_IDS)[number] = REPORT_SECTION_IDS[0]
    for (const id of REPORT_SECTION_IDS) {
      const el = document.getElementById(id)
      if (!el) continue
      const top = el.getBoundingClientRect().top + window.scrollY
      if (top <= y + 2) current = id
    }
    setActiveId(current)
  }, [])

  useEffect(() => {
    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('resize', updateActive, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [updateActive])

  return (
    <nav
      className={cn(
        'sticky top-0 z-50 -mx-1 mb-2 border-b border-border/60 bg-background/95 px-1 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/85',
        className
      )}
      aria-label="리포트 섹션 이동"
    >
      <div className="flex gap-1 overflow-x-auto pb-0.5 sm:gap-1.5">
        {TAB_ITEMS.map(({ id, label }) => {
          const active = activeId === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                scrollToSection(id)
                setActiveId(id)
              }}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-[13px]',
                active
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
