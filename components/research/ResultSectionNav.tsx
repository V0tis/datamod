'use client'

import { useEffect, useState } from 'react'
import { LayoutGrid, Lightbulb, TrendingUp, Users, Target, AlertTriangle, Newspaper, Database, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'section-summary', label: '분석 결과 요약', icon: LayoutGrid },
  { id: 'section-opportunity', label: '기회 점수 분해', icon: Target },
  { id: 'section-insights', label: '핵심 시장 인사이트', icon: Lightbulb },
  { id: 'section-timeline', label: 'AI 분석 타임라인', icon: GitBranch },
  { id: 'section-risks-opportunities', label: '리스크 및 기회 평가', icon: AlertTriangle },
  { id: 'section-market', label: '시장 성장 분석', icon: TrendingUp },
  { id: 'section-competition', label: '경쟁 환경 분석', icon: Users },
  { id: 'section-strategy', label: '전략 제안', icon: Target },
  { id: 'section-risks', label: '리스크 평가', icon: AlertTriangle },
  { id: 'section-news', label: '뉴스 및 데이터', icon: Newspaper },
  { id: 'section-data', label: '데이터 출처', icon: Database },
] as const

export interface ResultSectionNavProps {
  className?: string
  /** compact: horizontal pills. full: vertical. tabs: sticky top tabs. sidebar: sticky left sidebar with active highlight */
  variant?: 'compact' | 'full' | 'tabs' | 'sidebar'
}

export function ResultSectionNav({ className, variant = 'compact' }: ResultSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    if (variant !== 'tabs' && variant !== 'sidebar') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setActiveId(e.target.id)
            break
          }
        }
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 }
    )
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [variant])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (variant === 'sidebar') {
    return (
      <nav
        className={cn(
          'sticky top-14 flex flex-col gap-0.5 w-48 shrink-0 py-2',
          className
        )}
        aria-label="결과 섹션 탐색"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
          섹션
        </p>
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = activeId === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              <span className="truncate">{s.label}</span>
            </button>
          )
        })}
      </nav>
    )
  }

  if (variant === 'tabs') {
    return (
      <nav
        className={cn(
          'sticky top-0 z-20 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 py-0',
          'bg-background/95 backdrop-blur border-b border-border',
          'flex gap-0 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className
        )}
        aria-label="결과 섹션 탐색"
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = activeId === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                'shrink-0 flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              <span className="whitespace-nowrap">{s.label}</span>
            </button>
          )
        })}
      </nav>
    )
  }

  if (variant === 'full') {
    return (
      <nav className={cn('space-y-0.5', className)} aria-label="결과 섹션 탐색">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          섹션 이동
        </p>
        {SECTIONS.map((s) => {
          const Icon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0 opacity-70" />
              {s.label}
            </button>
          )
        })}
      </nav>
    )
  }

  return (
    <nav
      className={cn(
        'flex gap-1 overflow-x-auto pb-1 -mx-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20',
        className
      )}
      aria-label="결과 섹션 탐색"
    >
      {SECTIONS.map((s) => {
        const Icon = s.icon
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollTo(s.id)}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          >
            <Icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
