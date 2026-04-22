'use client'

import { cn } from '@/lib/utils'

export function MarketStatsRow({
  growth10,
  trend10,
  trendCount,
  confidencePct,
  trendSub,
  className,
}: {
  growth10: number | null
  trend10: number | null
  trendCount: number
  confidencePct: number | null
  trendSub?: string
  className?: string
}) {
  const conf =
    confidencePct != null && Number.isFinite(confidencePct)
      ? confidencePct > 1
        ? Math.round(confidencePct)
        : Math.round(confidencePct * 100)
      : null

  const stats = [
    {
      label: '시장 성장성',
      value: growth10 != null ? `${growth10}/10` : '—',
      sub: '원시 지표 반영',
      color: '#0D9F6E',
    },
    {
      label: '트렌드 모멘텀',
      value: trend10 != null ? `${trend10}/10` : '—',
      sub: trendSub?.trim() || '트렌드 데이터 반영',
      color: '#1B64DA',
    },
    {
      label: '핵심 트렌드',
      value: `${trendCount}개`,
      sub: '주요 트렌드 발견',
      color: '#7C3AED',
    },
    {
      label: '데이터 신뢰도',
      value: conf != null ? `${conf}%` : '—',
      sub: '교차검증 완료',
      color: '#D97706',
    },
  ]

  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80"
        >
          <div className="h-10 w-1 shrink-0 rounded-full" style={{ background: stat.color }} />
          <div className="min-w-0">
            <div className="text-xl font-bold tabular-nums" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="text-xs font-medium text-slate-600 dark:text-zinc-400">{stat.label}</div>
            <div className="truncate text-xs text-slate-400 dark:text-zinc-500" title={stat.sub}>
              {stat.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
