'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BarChart2,
  CheckSquare,
  LayoutDashboard,
  Lightbulb,
  Target,
  type LucideIcon,
} from 'lucide-react'
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

const TAB_ICONS: Record<ReportScrollSpyTabId, LucideIcon> = {
  'summary-section': LayoutDashboard,
  'market-section': BarChart2,
  'competitor-section': Target,
  'insight-strategy-section': Lightbulb,
  'action-section': CheckSquare,
}

type ReportSectionTabBarProps = {
  className?: string
  /**
   * 뷰포트 상단부터 스크롤 스파이 기준선까지의 픽셀 거리 (고정 네비 56px + 스티키 스택 높이).
   */
  scrollAnchorTopPx: number
}

/**
 * 분석 리포트 앵커 탭: IntersectionObserver 스크롤 스파이 + 아이콘 (부모 스티키 컨테이너 안에서 배치)
 */
export function ReportSectionTabBar({ className, scrollAnchorTopPx }: ReportSectionTabBarProps) {
  const navRef = useRef<HTMLElement>(null)

  const [activeId, setActiveId] = useState<ReportScrollSpyTabId>(REPORT_SCROLL_SPY_TAB_ORDER[0])

  const computeActive = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const line = scrollAnchorTopPx + 2

    let next: ReportScrollSpyTabId = REPORT_SCROLL_SPY_TAB_ORDER[0]
    for (const id of REPORT_SCROLL_SPY_TAB_ORDER) {
      const section = document.getElementById(id)
      if (!section) continue
      const top = section.getBoundingClientRect().top
      if (top <= line) next = id
    }
    setActiveId((prev) => (prev === next ? prev : next))
  }, [scrollAnchorTopPx])

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

  const activeClass =
    'border-[var(--dm-color-primary)] text-[var(--dm-color-primary)]  '
  const inactiveClass =
    'border-transparent text-[var(--dm-color-text-muted)] hover:border-[var(--dm-color-border-strong)] hover:text-[var(--dm-color-text-secondary)] '

  return (
    <nav
      ref={navRef}
      className={cn(
        'border-b border-[var(--dm-color-border)] bg-[var(--dm-color-surface)] px-4 sm:px-6',
        className
      )}
      aria-label="리포트 섹션"
    >
      <div className="relative md:static">
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-6 bg-gradient-to-r from-[var(--dm-color-surface)] to-transparent md:hidden"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-6 bg-gradient-to-l from-[var(--dm-color-surface)] to-transparent md:hidden"
          aria-hidden
        />
        <div className="overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-full min-w-min gap-1">
            {REPORT_SCROLL_SPY_TAB_ORDER.map((id) => {
              const isActive = activeId === id
              const Icon = TAB_ICONS[id]
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => scrollToSection(id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4',
                    isActive ? activeClass : inactiveClass
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
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
