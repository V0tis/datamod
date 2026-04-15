'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  REPORT_SECTION_IDS,
  REPORT_STICKY_TAB_IDS,
  REPORT_STICKY_TAB_LABELS,
  type ReportSectionId,
  type ReportStickyTabId,
} from '@/lib/report-section-ids'
import { useResultsMainScrolledPast } from '@/hooks/use-results-main-scroll'

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function sectionToStickyTab(id: ReportSectionId): ReportStickyTabId | null {
  if (id === 'summary') return null
  if (id === 'action') return 'strategic'
  return REPORT_STICKY_TAB_IDS.includes(id as ReportStickyTabId) ? (id as ReportStickyTabId) : null
}

/**
 * 분석 리포트 전용 상단 탭(시장·경쟁·인사이트·전략). 글로벌 헤더 숨김 시 top-0.
 * IntersectionObserver + 가시 비율로 활성 탭 동기화.
 */
export function ReportSectionTabBar({ className }: { className?: string }) {
  const hideGlobalHeader = useResultsMainScrolledPast(28)
  const [activeStickyId, setActiveStickyId] = useState<ReportStickyTabId | null>(null)

  const pickActiveFromObserver = useCallback(() => {
    const root = document.querySelector('main')
    if (!root) return

    const ratios = new Map<string, number>()
    for (const id of REPORT_SECTION_IDS) {
      const el = document.getElementById(id)
      if (!el) continue
      const r = el.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      const interTop = Math.max(r.top, rootRect.top)
      const interBottom = Math.min(r.bottom, rootRect.bottom)
      const h = Math.max(0, interBottom - interTop)
      const visible = h / Math.min(r.height, rootRect.height || 1)
      ratios.set(id, visible)
    }
    let best: ReportSectionId = REPORT_SECTION_IDS[0]
    let bestScore = -1
    for (const id of REPORT_SECTION_IDS) {
      const sc = ratios.get(id) ?? 0
      if (sc > bestScore) {
        bestScore = sc
        best = id
      }
    }
    if (bestScore <= 0.02) return
    setActiveStickyId(sectionToStickyTab(best))
  }, [])

  useEffect(() => {
    const root = document.querySelector('main')
    if (!root) return

    const obs = new IntersectionObserver(
      () => {
        pickActiveFromObserver()
      },
      {
        root,
        rootMargin: '-18% 0px -55% 0px',
        threshold: [0, 0.05, 0.15, 0.35, 0.55, 0.75, 1],
      }
    )

    for (const id of REPORT_SECTION_IDS) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }

    pickActiveFromObserver()
    root.addEventListener('scroll', pickActiveFromObserver, { passive: true })
    window.addEventListener('resize', pickActiveFromObserver, { passive: true })

    return () => {
      obs.disconnect()
      root.removeEventListener('scroll', pickActiveFromObserver)
      window.removeEventListener('resize', pickActiveFromObserver)
    }
  }, [pickActiveFromObserver])

  return (
    <>
      <nav
        className={cn(
          'fixed left-0 right-0 z-[60] border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background/90',
          'md:px-4 lg:px-6',
          /* 글로벌 헤더(3.5rem) 아래 고정 — 상단 보조 버튼 제거 후에도 동일 오프셋 유지 */
          hideGlobalHeader ? 'top-0' : 'top-14',
          'transition-[top] duration-200 ease-out',
          className
        )}
        aria-label="분석 리포트 섹션"
      >
        <div className="mx-auto flex w-full max-w-[min(100%,1920px)] justify-center sm:justify-start">
          <div className="flex max-w-full gap-1 overflow-x-auto pb-0.5 sm:gap-1.5">
            {REPORT_STICKY_TAB_IDS.map((id) => {
              const active = activeStickyId === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    scrollToSection(id)
                    setActiveStickyId(id)
                  }}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-[13px]',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {REPORT_STICKY_TAB_LABELS[id]}
                </button>
              )
            })}
          </div>
        </div>
      </nav>
      <div className="h-[52px] shrink-0" aria-hidden />
    </>
  )
}
