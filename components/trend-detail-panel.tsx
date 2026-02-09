'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { BarChart3, Tag, X } from 'lucide-react'
import type { TrendItem } from '@/lib/trends-types'
import { TrendNewsList } from '@/components/trend-news-list'

export interface TrendDetailPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedItem: TrendItem | null
  /** "이 키워드로 분석하기" 클릭 시 (키워드 전달) */
  onAnalyze: (keyword: string) => void
}

const PANEL_MAX_W = '28rem'
const NEWS_LIST_MAX_H_CLASS = 'max-h-[min(50vh,320px)]'

/**
 * 트렌드 키워드 상세 패널 (우측 슬라이딩).
 * Framer Motion 슬라이드 전환, 헤더·그래프 고정, 뉴스 영역만 스크롤.
 * 뉴스 링크는 TrendNewsList에서 구글 번역 프록시로 열림.
 */
export function TrendDetailPanel({ open, onOpenChange, selectedItem, onAnalyze }: TrendDetailPanelProps) {
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => onOpenChange(false)}
            aria-hidden
          />
          <motion.div
            key="panel"
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col border-l border-border"
            style={{ maxWidth: PANEL_MAX_W }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* 고정: 헤더 */}
            <div className="shrink-0 p-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground truncate pr-2">
                {selectedItem ? (selectedItem.title_ko ?? selectedItem.keyword) : '트렌드 상세'}
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1 rounded hover:bg-muted"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 고정: 그래프 */}
            {selectedItem && (
              <div className="shrink-0 p-4 border-b border-border">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <BarChart3 className="h-3.5 w-3.5" /> 검색 추이
                </p>
                {selectedItem.picture_url ? (
                  <img
                    src={selectedItem.picture_url}
                    alt={`${selectedItem.keyword} 검색 추이`}
                    className="w-full h-32 object-cover rounded-lg border border-border bg-muted/20"
                  />
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 h-32 flex items-center justify-center text-muted-foreground text-sm">
                    그래프 이미지 (Google Trends 연동 시 표시)
                  </div>
                )}
              </div>
            )}

            {/* 스크롤: 뉴스만 (헤더·그래프는 고정) */}
            {selectedItem && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <p className="shrink-0 px-4 pt-3 pb-1 text-xs text-muted-foreground">관련 뉴스</p>
                <div className="px-4 pb-4 min-h-0 flex-1">
                  <TrendNewsList
                    items={
                      ((selectedItem.news_items_ko?.length ?? 0) > 0
                        ? selectedItem.news_items_ko
                        : selectedItem.news_items) ?? []
                    }
                    emptyMessage='관련 뉴스는 &quot;이 키워드로 분석하기&quot; 실행 후 리서치 결과에서 확인할 수 있어요.'
                    listClassName={`overflow-y-auto overscroll-behavior-y-auto ${NEWS_LIST_MAX_H_CLASS} rounded-lg border border-border pr-1`}
                  />
                </div>
              </div>
            )}

            {/* 고정: 연관 키워드 + 버튼 */}
            {selectedItem && (
              <div className="shrink-0 p-4 border-t border-border bg-white space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> 연관 키워드
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedItem.analysis_keywords?.length ?? 0) > 0
                      ? selectedItem.analysis_keywords.map((kw, j) => (
                          <span
                            key={j}
                            className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs font-normal"
                          >
                            {kw}
                          </span>
                        ))
                      : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    onAnalyze(selectedItem.keyword)
                    onOpenChange(false)
                  }}
                >
                  이 키워드로 분석하기
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
