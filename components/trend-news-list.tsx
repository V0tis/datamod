'use client'

import { Newspaper } from 'lucide-react'
import type { TrendNewsItem, TrendNewsItemKo } from '@/lib/trends-types'

/** 뉴스 링크를 새 탭에서 구글 번역 프록시로 열기 위한 URL */
export function getGoogleTranslateProxyUrl(originalUrl: string): string {
  return `https://translate.google.com/translate?sl=auto&tl=ko&u=${encodeURIComponent(originalUrl)}`
}

type NewsItem = TrendNewsItem | TrendNewsItemKo

function isNewsItemKo(item: NewsItem): item is TrendNewsItemKo {
  return 'title_ko' in item && typeof (item as TrendNewsItemKo).title_ko === 'string'
}

export interface TrendNewsListProps {
  /** news_items_ko 우선, 없으면 news_items */
  items: NewsItem[]
  className?: string
  listClassName?: string
  emptyMessage?: string
}

/**
 * 트렌드 상세 패널용 뉴스 목록.
 * 번역된 제목(title_ko)을 메인으로 표시하고, 원문은 작게 흐린 글씨로 표시.
 * 번역된 항목은 구글 번역 프록시 링크로 열기.
 */
export function TrendNewsList({ items, className, listClassName, emptyMessage }: TrendNewsListProps) {
  if (items.length === 0) {
    return (
      <p className={className ?? 'rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground'}>
        {emptyMessage ?? '관련 뉴스가 없어요.'}
      </p>
    )
  }

  return (
    <div className={listClassName ?? 'overflow-y-auto overscroll-behavior-y-auto max-h-64 rounded-lg border border-border pr-1'}>
      <ul className="space-y-0">
        {items.map((news, idx) => {
          const isKo = isNewsItemKo(news)
          const displayTitle = isKo ? news.title_ko : news.title
          const originalTitle = isKo ? news.title : undefined
          const newsUrl = news.url
          const href =
            isKo && newsUrl ? getGoogleTranslateProxyUrl(newsUrl) : newsUrl || '#'
          return (
            <li key={idx} className="mb-4 last:mb-0">
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
                    className="w-16 h-16 shrink-0 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 shrink-0 rounded border border-border bg-muted flex items-center justify-center text-muted-foreground">
                    <Newspaper className="h-6 w-6" aria-hidden />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{displayTitle}</p>
                  {originalTitle != null && originalTitle !== displayTitle ? (
                    <p className="text-xs text-muted-foreground/80 mt-0.5 line-clamp-1">{originalTitle}</p>
                  ) : null}
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
