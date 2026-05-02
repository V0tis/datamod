'use client'

import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
import { cn } from '@/lib/utils'
import { formatDisplayKeyword } from '@/lib/format-display-keyword'

function statusLabel(status: string | null | undefined, analyzing: boolean): string {
  if (analyzing || status === 'analyzing') return '분석 중'
  if (status === 'queued') return '대기'
  if (status === 'failed') return '실패'
  if (status === 'completed') return '완료'
  if (!status) return '요약 대기'
  return status
}

export function RecentAnalyses({
  recentReports,
  recentReportsLoading,
}: {
  recentReports: {
    id?: string
    keyword: string
    created_at: string | null
    country_code: string
    opportunity_score?: number | null
    analysis_status?: string | null
  }[]
  recentReportsLoading: boolean
}) {
  return (
    <section className="rounded-[12px] border border-[#E5E9F2] bg-white p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-700">최근 분석</h2>
        <Link
          href="/history"
          className="shrink-0 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          전체 보기 →
        </Link>
      </div>

      {recentReportsLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] w-[200px] shrink-0 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : recentReports.length === 0 ? (
        <p className="py-6 text-sm text-[#6B7280]">아직 기록이 없습니다</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {recentReports.map((r, i) => {
            const analyzing = r.analysis_status === 'analyzing' || r.analysis_status === 'queued'
            const displayKeyword = formatDisplayKeyword(r.keyword)
            const href = `/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`
            const scoreDisplay =
              r.opportunity_score != null ? (
                <span className="ml-2 shrink-0 text-base font-bold tabular-nums text-blue-600">{r.opportunity_score}</span>
              ) : (
                <span className="ml-2 shrink-0 text-base font-bold tabular-nums text-gray-300">--</span>
              )
            return (
              <Link
                key={r.id ?? `${r.keyword}-${r.created_at ?? i}`}
                href={href}
                className={cn(
                  'flex w-[200px] shrink-0 flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all',
                  'hover:border-blue-200 hover:shadow-sm'
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-1">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900" title={r.keyword || undefined}>
                    {displayKeyword}
                  </span>
                  {analyzing ? (
                    <Loader2 size={18} className="shrink-0 animate-spin text-amber-500" aria-hidden />
                  ) : (
                    scoreDisplay
                  )}
                </div>
                <div className="mb-3 text-xs text-gray-400">
                  {statusLabel(r.analysis_status, analyzing)}
                  {r.created_at ? (
                    <>
                      {' · '}
                      <TimeAgo isoString={r.created_at} />
                    </>
                  ) : null}
                </div>
                <span className="mt-auto text-xs font-medium text-blue-600">열기 →</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
