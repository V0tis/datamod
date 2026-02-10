'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Button } from '@/components/ui/button'
import { X, Info } from 'lucide-react'
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
 * Framer Motion 슬라이드 전환, 헤더·그래프 고정, 뉴스 영역만 스크롤.
 * 뉴스 링크는 TrendNewsList에서 구글 번역 프록시로 열림.
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

            {/* 고정: 상승세 요약 (picture_url) */}
            {selectedItem && (
              <div className="shrink-0 p-4 border-b border-border">
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-xs text-muted-foreground">상승세 요약</p>
                  <Tooltip.Provider delayDuration={300}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          className="inline-flex text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded p-0.5"
                          aria-label="상승세 요약 설명"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="bottom"
                          sideOffset={6}
                          className="z-[100] max-w-[260px] rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md border border-border"
                        >
                          해당 키워드의 현재 검색 의도와 가장 밀접한 시각적 정보를 Google에서 실시간으로 수집하여 보여줍니다.
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>
                {selectedItem.picture_url ? (
                  <>
                    <div className="relative w-full h-32 rounded-lg border border-border bg-muted/20 overflow-hidden">
                      <img
                        src={selectedItem.picture_url}
                        alt="Trend momentum thumbnail"
                        className="w-full h-full object-cover"
                      />
                      <span
                        className="absolute bottom-2 right-2 px-2 py-1 rounded text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm"
                        role="img"
                        aria-label="Google 실시간 요약"
                      >
                        Google 실시간 요약
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      ※ 본 이미지는 데이터 수집 시점의 대표 스냅샷으로, 실제 현황과 다를 수 있습니다.
                    </p>
                  </>
                ) : (
                  <div className="rounded-lg border border-border bg-muted/20 h-32 flex items-center justify-center text-muted-foreground text-sm">
                    그래프 이미지 (Google Trends 연동 시 표시)
                  </div>
                )}
              </div>
            )}

            {/* 스크롤: 관련 뉴스 (news_items 원문, 남은 공간 채움) */}
            {selectedItem && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <p className="shrink-0 px-4 pt-3 pb-1 text-xs text-muted-foreground">관련 뉴스</p>
                <div className="px-4 pb-4 min-h-0 flex-1 overflow-hidden flex flex-col">
                  <TrendNewsList
                    items={selectedItem.news_items ?? []}
                    emptyMessage="현재 관련 뉴스가 없습니다."
                    listClassName="overflow-y-auto overscroll-behavior-y-auto flex-1 min-h-0 rounded-lg border border-border pr-1"
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
