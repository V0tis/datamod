'use client'

import { Newspaper, Globe, ExternalLink } from 'lucide-react'
import type { TrendNewsItem } from '@/lib/trends-types'

export interface TrendNewsListProps {
  /** news_items (원문) */
  items: TrendNewsItem[]
  className?: string
  listClassName?: string
  emptyMessage?: string
  /** true이면 스켈레톤 카드 표시 */
  loading?: boolean
  /** true이면 첫 번째 뉴스를 더 큰 카드로 표시 */
  highlightFirst?: boolean
}

function NewsListSkeleton() {
  return (
    <ul className="space-y-3">
      {[1, 2, 3].map((i) => (
        <li key={i} className="flex gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="w-20 h-20 shrink-0 rounded bg-muted animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 rounded bg-muted animate-pulse w-full" />
            <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
            <div className="h-3 rounded bg-muted animate-pulse w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * 트렌드 상세 패널용 뉴스 목록. 가로형 카드(좌: 썸네일, 우: 제목·출처).
 * 클릭 시 뉴스 원문 URL로 새 탭.
 */
export function TrendNewsList({ items, className, listClassName, emptyMessage, loading, highlightFirst }: TrendNewsListProps) {
  if (loading) {
    return (
      <div className={listClassName ?? 'rounded-lg border border-border p-3'}>
        <NewsListSkeleton />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <p className={className ?? 'rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground'}>
        {emptyMessage ?? '현재 관련 뉴스가 없습니다.'}
      </p>
    )
  }

  const isFirst = (idx: number) => highlightFirst && idx === 0

  return (
    <div className={listClassName ?? 'overflow-y-auto overscroll-behavior-y-auto max-h-64 rounded-lg pr-1'}>
      <ul className="space-y-3">
        {items.map((news, idx) => {
          const href = news.url || '#'
          const first = isFirst(idx)
          return (
            <li key={idx}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex gap-3 rounded-lg border bg-card hover:bg-gray-50 dark:bg-[#202226] dark:border-[#2d2f34] dark:hover:bg-[#1c1e21] transition-colors duration-300 text-left shadow-sm ${
                  first
                    ? 'border-primary/30 p-4 ring-1 ring-primary/10 dark:ring-[#00d19a]/20 dark:border-[#00d19a]/30'
                    : 'border-border dark:border-[#2d2f34] p-3'
                }`}
              >
                {news.image ? (
                  <img
                    src={news.image}
                    alt=""
                    className={`shrink-0 object-cover rounded-md border border-border ${
                      first ? 'w-24 h-24' : 'w-20 h-20'
                    }`}
                  />
                ) : (
                  <div
                    className={`shrink-0 rounded-md border border-border dark:border-[#2d2f34] bg-muted/50 dark:bg-[#2a2d32]/60 flex items-center justify-center text-muted-foreground dark:text-slate-400 ${
                      first ? 'w-24 h-24' : 'w-20 h-20'
                    }`}
                  >
                    <Newspaper className={first ? 'h-7 w-7' : 'h-6 w-6'} aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-medium text-foreground dark:text-[#e1e3e6] line-clamp-2 ${first ? 'text-base' : 'text-sm'}`}>
                    {news.title}
                  </p>
                  {news.source ? (
                    <span className="inline-flex items-center gap-1.5 mt-1.5">
                      <Globe className="h-3 w-3 text-muted-foreground dark:text-slate-400 shrink-0" aria-hidden />
                      <span className="text-xs font-medium text-muted-foreground dark:text-slate-400 bg-muted/70 dark:bg-slate-700/60 px-2 py-0.5 rounded">
                        {news.source}
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/80 shrink-0" aria-hidden />
                    </span>
                  ) : null}
                </div>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
