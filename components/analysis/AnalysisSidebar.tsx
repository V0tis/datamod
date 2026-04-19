'use client'

import { cn } from '@/lib/utils'
import { REPORT_SCROLL_SPY_TAB_LABELS, REPORT_SCROLL_SPY_TAB_ORDER, type ReportScrollSpyTabId } from '@/lib/report-section-ids'
import { scrollToReportSection } from '@/components/analysis/report-scroll-toc'

function scrollToTopAnchor() {
  document.getElementById('pm-dashboard-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export type AnalysisSidebarProps = {
  className?: string
}

/**
 * 데스크톱 전용( lg+ ) 고정 좌측 목차 — 리포트 섹션으로 부드럽게 스크롤합니다.
 */
export function AnalysisSidebar({ className }: AnalysisSidebarProps) {
  return (
    <aside
      className={cn(
        /** 고정 좁은 폭 — 본문이 행의 나머지 전부를 사용 */
        'hidden w-36 shrink-0 border-r border-border/60 bg-background/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-background/90 lg:block',
        className
      )}
      aria-label="분석 리포트 목차"
    >
      <nav className="flex flex-col gap-0.5 px-1.5 py-4">
        <p className="mb-2 px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">리포트</p>
        <button
          type="button"
          onClick={scrollToTopAnchor}
          className="rounded-md px-1.5 py-2 text-left text-[12px] font-medium leading-snug text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          맨 위로
        </button>
        {REPORT_SCROLL_SPY_TAB_ORDER.map((id: ReportScrollSpyTabId) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToReportSection(id)}
            className="rounded-md px-1.5 py-2 text-left text-[12px] font-medium leading-snug text-foreground transition-colors hover:bg-muted"
          >
            {REPORT_SCROLL_SPY_TAB_LABELS[id]}
          </button>
        ))}
      </nav>
    </aside>
  )
}
