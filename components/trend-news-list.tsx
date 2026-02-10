'use client'

import { Newspaper } from 'lucide-react'
import type { TrendNewsItem } from '@/lib/trends-types'

/** 뉴스 링크를 새 탭에서 구글 번역 프록시로 열기 위한 URL */
export function getGoogleTranslateProxyUrl(originalUrl: string): string {
  return `https://translate.google.com/translate?sl=auto&tl=ko&u=${encodeURIComponent(originalUrl)}`
}

export interface TrendNewsListProps {
  /** news_items (원문) */
  items: TrendNewsItem[]
  className?: string
  listClassName?: string
  emptyMessage?: string
  /** true이면 스켈레톤 카드 표시 */
  loading?: boolean
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
 * 클릭 시 구글 번역 프록시 URL로 새 탭.
 */
export function TrendNewsList({ items, className, listClassName, emptyMessage, loading }: TrendNewsListProps) {
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

  return (
    <div className={listClassName ?? 'overflow-y-auto overscroll-behavior-y-auto max-h-64 rounded-lg border border-border pr-1'}>
      <ul className="space-y-3">
        {items.map((news, idx) => {
          const href = news.url ? getGoogleTranslateProxyUrl(news.url) : '#'
          return (
            <li key={idx}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors text-left"
              >
                {news.image ? (
                  <img
                    src={news.image}
                    alt=""
                    className="w-20 h-20 shrink-0 object-cover rounded"
                  />
                ) : (
                  <div className="w-20 h-20 shrink-0 rounded border border-border bg-muted flex items-center justify-center text-muted-foreground">
                    <Newspaper className="h-6 w-6" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{news.title}</p>
                  {news.source ? (
                    <p className="text-xs text-muted-foreground mt-0.5">{news.source}</p>
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
