'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  REPORT_SCROLL_SPY_TAB_ORDER,
  REPORT_SCROLL_SPY_TAB_LABELS,
  type ReportScrollSpyTabId,
} from '@/lib/report-section-ids'

function scrollToSection(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const ACTIVE = 'border-b-2 border-[#4F6EF7] text-[#4F6EF7] font-semibold dark:border-[#6B8AFF] dark:text-[#6B8AFF]'
const INACTIVE =
  'border-b-2 border-transparent text-[#6B7280] font-normal dark:text-zinc-400 dark:border-transparent'

type ReportSectionTabBarProps = {
  className?: string
  /** 뷰포트 상단 기준 sticky top (px) — 고정 헤더 + 파이프라인 높이 합 */
  stickyTopPx: number
  /** 앵커 스크롤 시 본문이 가리지 않도록 부모에서 scroll-margin 계산용 */
  onTabBarHeight?: (heightPx: number) => void
}

/**
 * 단일 스크롤 페이지용 앵커 네비: IntersectionObserver + 스크롤로 활성 탭 1개만 강조,
 * 클릭 시 해당 섹션으로 smooth-scroll.
 */
export function ReportSectionTabBar({ className, stickyTopPx, onTabBarHeight }: ReportSectionTabBarProps) {
  const navRef = useRef<HTMLElement>(null)
  const [activeId, setActiveId] = useState<ReportScrollSpyTabId>(REPORT_SCROLL_SPY_TAB_ORDER[0])

  useLayoutEffect(() => {
    const el = navRef.current
    if (!el || !onTabBarHeight) return
    const ro = new ResizeObserver(() => {
      onTabBarHeight(Math.round(el.getBoundingClientRect().height))
    })
    ro.observe(el)
    onTabBarHeight(Math.round(el.getBoundingClientRect().height))
    return () => ro.disconnect()
  }, [onTabBarHeight])

  const computeActive = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const tabH = nav.getBoundingClientRect().height
    const line = stickyTopPx + tabH + 2

    let next: ReportScrollSpyTabId = REPORT_SCROLL_SPY_TAB_ORDER[0]
    for (const id of REPORT_SCROLL_SPY_TAB_ORDER) {
      const section = document.getElementById(id)
      if (!section) continue
      const top = section.getBoundingClientRect().top
      if (top <= line) next = id
    }
    setActiveId((prev) => (prev === next ? prev : next))
  }, [stickyTopPx])

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const obs = new IntersectionObserver(
      () => {
        computeActive()
      },
      {
        root: main,
        rootMargin: '0px',
        threshold: [0, 0.02, 0.06, 0.12, 0.2, 0.35, 0.5, 0.65, 0.8, 1],
      }
    )

    for (const id of REPORT_SCROLL_SPY_TAB_ORDER) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }

    computeActive()
    main.addEventListener('scroll', computeActive, { passive: true })
    window.addEventListener('resize', computeActive, { passive: true })

    return () => {
      obs.disconnect()
      main.removeEventListener('scroll', computeActive)
      window.removeEventListener('resize', computeActive)
    }
  }, [computeActive])

  return (
    <nav
      ref={navRef}
      className={cn(
        'sticky z-40 border-b border-zinc-200/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/90',
        'dark:border-zinc-800',
        className
      )}
      style={{ top: stickyTopPx }}
      aria-label="리포트 섹션 앵커"
    >
      <div className="relative md:static">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-background via-background/90 to-transparent md:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-background via-background/90 to-transparent md:hidden"
          aria-hidden
        />
        <div className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="mx-auto flex w-full min-w-min max-w-[min(100%,1920px)] gap-0 px-1 sm:px-2">
            {REPORT_SCROLL_SPY_TAB_ORDER.map((id) => {
              const isActive = activeId === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => scrollToSection(id)}
                  className={cn(
                    'shrink-0 whitespace-nowrap px-3 py-2.5 text-sm transition-colors sm:px-4 sm:text-[13px]',
                    isActive ? ACTIVE : INACTIVE
                  )}
                >
                  {REPORT_SCROLL_SPY_TAB_LABELS[id]}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
