'use client'

import { cn } from '@/lib/utils'

export type ReportTocItem = { id: string; label: string }

const DEFAULT_ITEMS: ReportTocItem[] = [
  { id: 'report-summary', label: '요약·기회 점수' },
  { id: 'report-market', label: '시장·트렌드' },
  { id: 'report-competition', label: '경쟁 환경' },
  { id: 'report-insights', label: '핵심 인사이트' },
  { id: 'report-strategic', label: '전략·프레임워크' },
  { id: 'report-action', label: '액션 플랜' },
]

/** 사용자가 목차를 클릭했을 때만 스크롤(자동 스크롤·포커스 강제 없음). */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function scrollToReportSection(id: string) {
  scrollToSection(id)
}

export function ReportScrollToc({
  items = DEFAULT_ITEMS,
  className,
}: {
  items?: ReportTocItem[]
  className?: string
}) {
  return (
    <nav
      className={cn(
        'rounded-lg border border-slate-100 bg-white/95 p-2 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95',
        className
      )}
      aria-label="리포트 목차"
    >
      <p className="mb-1.5 px-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">목차</p>
      <ul className="flex gap-0.5 overflow-x-auto pb-0.5 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => (
          <li key={item.id} className="shrink-0 lg:w-full">
            <button
              type="button"
              onClick={() => scrollToSection(item.id)}
              className={cn(
                'w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-slate-600 transition-colors',
                'hover:bg-emerald-50 hover:text-emerald-900 dark:text-zinc-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100',
                'lg:whitespace-normal'
              )}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
