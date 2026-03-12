'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutGrid, Lightbulb, TrendingUp, Users, Target, AlertTriangle, Newspaper, Database, GitBranch, Briefcase, Gauge, CheckSquare2, Loader2, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motionConfig } from '@/lib/motion-config'

/** Core 6 sections for sticky quick-jump nav (matches ResultPageStructuredSections) */
const CORE_SECTIONS = [
  { id: 'section-market-summary', label: '시장 개요', icon: BarChart3 },
  { id: 'section-key-insights', label: '핵심 인사이트', icon: Lightbulb },
  { id: 'section-market-trends', label: '시장 트렌드', icon: TrendingUp },
  { id: 'section-competitor-landscape', label: '경쟁 환경', icon: Users },
  { id: 'section-strategic-recommendations', label: '전략 제안', icon: Target },
  { id: 'section-action-plan', label: '액션 플랜', icon: CheckSquare2 },
] as const

const SECTIONS = [
  { id: 'section-timeline', label: 'AI 분석 타임라인', icon: GitBranch },
  { id: 'section-summary', label: '분석 결과 요약', icon: LayoutGrid },
  { id: 'section-opportunity', label: '기회 점수 분해', icon: Target },
  { id: 'section-strategic-decision', label: '전략적 의사결정', icon: Gauge },
  { id: 'section-strategy-evaluation', label: '전략 평가', icon: BarChart3 },
  { id: 'section-insights', label: '핵심 시장 인사이트', icon: Lightbulb },
  { id: 'section-product-strategy', label: '제품 전략 결과', icon: Briefcase },
  { id: 'section-risks-opportunities', label: '리스크 및 기회 평가', icon: AlertTriangle },
  { id: 'section-market', label: '시장 성장 분석', icon: TrendingUp },
  { id: 'section-competition', label: '경쟁 환경 분석', icon: Users },
  { id: 'section-frameworks', label: '전략 프레임워크', icon: LayoutGrid },
  { id: 'section-strategy', label: '전략 제안', icon: Target },
  { id: 'section-risks', label: '리스크 평가', icon: AlertTriangle },
  { id: 'section-news', label: '뉴스 및 데이터', icon: Newspaper },
  { id: 'section-data', label: '데이터 출처', icon: Database },
  { id: 'section-next-actions-pm', label: 'Next Actions for PM', icon: CheckSquare2 },
] as const

export interface ResultSectionNavProgress {
  /** Whether analysis is in progress */
  loading: boolean
  /** 0-100 completeness percent */
  percent: number
}

export interface ResultSectionNavProps {
  className?: string
  /** compact: horizontal pills. full: vertical. tabs: sticky top tabs. sidebar: sticky left sidebar with active highlight */
  variant?: 'compact' | 'full' | 'tabs' | 'sidebar'
  /** When 'core', show only 5 key sections for quick jump (Market Analysis, Insights, Strategy, Competitors, Action Plan) */
  mode?: 'full' | 'core'
  /** Progress indicator for analysis completeness (shown in tabs/sidebar when provided) */
  progress?: ResultSectionNavProgress
}

export function ResultSectionNav({
  className,
  variant = 'compact',
  mode = 'full',
  progress,
}: ResultSectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sections = mode === 'core' ? CORE_SECTIONS : SECTIONS

  useEffect(() => {
    if (variant !== 'tabs' && variant !== 'sidebar') return
    const updateActive = () => {
      const triggerY = 120
      let active: string | null = null
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i].id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= triggerY && rect.bottom > triggerY) {
          active = sections[i].id
          break
        }
        if (rect.top < triggerY) {
          active = sections[i].id
          break
        }
      }
      if (!active && sections.length > 0) {
        const first = document.getElementById(sections[0].id)
        if (first && first.getBoundingClientRect().top > 0) active = sections[0].id
        else active = sections[sections.length - 1].id
      }
      setActiveId((prev) => (prev !== active ? active : prev))
    }
    const observer = new IntersectionObserver(
      () => {
        updateActive()
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    updateActive()
    const onScroll = () => requestAnimationFrame(updateActive)
    const main = document.querySelector('main')
    if (main) main.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateActive)
    return () => {
      observer.disconnect()
      if (main) main.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateActive)
    }
  }, [variant, mode])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const showProgress = progress != null
  const pct = progress?.percent ?? 0
  const ProgressBar = showProgress ? (
    <div className="px-2 py-2 border-b border-border/60 mb-2">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          분석 진행
        </span>
        {progress!.loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
        ) : (
          <span className="text-[11px] font-medium tabular-nums text-primary">
            {Math.round(pct)}%
          </span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="분석 완료율"
        />
      </div>
    </div>
  ) : null

  if (variant === 'sidebar') {
    return (
      <nav
        className={cn(
          'flex flex-col gap-0.5 w-full shrink-0 py-2',
          'overflow-y-auto overflow-x-hidden',
          className
        )}
        aria-label="결과 섹션 탐색"
      >
        {ProgressBar}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-2">
          섹션
        </p>
        {sections.map((s) => {
          const Icon = s.icon
          const isActive = activeId === s.id
          return (
            <div key={s.id} className="relative">
              {/* Animated active indicator */}
              <motion.span
                aria-hidden
                initial={false}
                animate={{ opacity: isActive ? 1 : 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-primary origin-center"
              />
              <motion.button
                type="button"
                onClick={() => scrollTo(s.id)}
                layout={false}
                whileHover={{
                  x: motionConfig.navHover.x,
                  transition: motionConfig.navHover.transition,
                }}
                className={cn(
                  'relative w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm',
                  'transition-colors duration-200',
                  isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0 opacity-80 transition-opacity duration-200',
                    isActive && 'opacity-100'
                  )}
                />
                <span className="truncate">{s.label}</span>
              </motion.button>
            </div>
          )
        })}
      </nav>
    )
  }

  if (variant === 'tabs') {
    return (
      <div className={cn('sticky top-0 z-20 -mx-3 sm:-mx-4 md:-mx-6', className)}>
        {showProgress && (
          <div className="px-3 sm:px-4 md:px-6 py-2 bg-background/95 backdrop-blur border-b border-border/60">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                분석 진행
              </span>
              {progress!.loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
              ) : (
                <span className="text-xs font-semibold tabular-nums text-primary">
                  {Math.round(pct)}%
                </span>
              )}
            </div>
            <div className="h-1.5 mt-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="분석 완료율"
              />
            </div>
          </div>
        )}
        <nav
          className={cn(
            'flex gap-0 overflow-x-auto scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'bg-background/95 backdrop-blur border-b border-border',
            showProgress ? 'px-3 sm:px-4 md:px-6 py-2' : 'px-3 sm:px-4 md:px-6 py-0'
          )}
          aria-label="결과 섹션 탐색"
        >
        {sections.map((s) => {
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
      </div>
    )
  }

  if (variant === 'full') {
    return (
      <nav className={cn('space-y-0.5', className)} aria-label="결과 섹션 탐색">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
          섹션 이동
        </p>
        {sections.map((s) => {
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
      {sections.map((s) => {
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
