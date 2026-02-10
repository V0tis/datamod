'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
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

/**
 * 트렌드 키워드 상세 패널 (우측 슬라이딩).
 * 헤더 고정, 관련 뉴스 영역 스크롤.
 * 뉴스 링크는 TrendNewsList에서 원문 URL로 새 탭.
 */
export function TrendDetailPanel({ open, onOpenChange, selectedItem, onAnalyze }: TrendDetailPanelProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && open && typeof document !== 'undefined') {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [mounted, open])

  const isClient = mounted && typeof window !== 'undefined'
  if (!isClient) return null

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
            {/* 고정: 헤더 — 번역 키워드 */}
            <div className="shrink-0 p-4 border-b border-border flex items-start justify-between gap-3">
              <h2 className="text-2xl font-bold text-foreground leading-tight min-w-0 flex-1">
                {selectedItem ? (
                  <span className="break-words">{selectedItem.title_ko ?? selectedItem.keyword}</span>
                ) : (
                  '트렌드 상세'
                )}
              </h2>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1 rounded hover:bg-muted shrink-0"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 스크롤: 관련 뉴스 최상단 배치 */}
            {selectedItem && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <p className="shrink-0 px-4 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">관련 뉴스</p>
                <div className="px-4 pb-4 min-h-0 flex-1 overflow-hidden flex flex-col">
                  <TrendNewsList
                    items={selectedItem.news_items ?? []}
                    emptyMessage="현재 관련 뉴스가 없습니다."
                    listClassName="overflow-y-auto overscroll-behavior-y-auto flex-1 min-h-0 rounded-lg pr-1"
                    highlightFirst
                  />
                </div>
              </div>
            )}

            {/* 고정: 분석 버튼 */}
            {selectedItem && (
              <div className="shrink-0 p-4 border-t border-border bg-white">
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
