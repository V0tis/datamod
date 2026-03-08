'use client'

import { Lightbulb, TrendingUp, Users, Target, AlertTriangle, GitBranch } from 'lucide-react'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { id: 'section-insights', label: '핵심 시장 인사이트', icon: Lightbulb },
  { id: 'section-market', label: '시장 성장 분석', icon: TrendingUp },
  { id: 'section-competition', label: '경쟁 환경 분석', icon: Users },
  { id: 'section-strategy', label: '전략 제안', icon: Target },
  { id: 'section-risks', label: '리스크 평가', icon: AlertTriangle },
  { id: 'section-pipeline', label: 'AI 분석 과정', icon: GitBranch },
] as const

export interface ResultSectionNavProps {
  className?: string
  /** Compact: horizontal scrollable pills. Full: vertical list */
  variant?: 'compact' | 'full'
}

export function ResultSectionNav({ className, variant = 'compact' }: ResultSectionNavProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
