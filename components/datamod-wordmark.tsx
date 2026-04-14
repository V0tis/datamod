'use client'

import { cn } from '@/lib/utils'

/** Electric Blue — 마지막 글자 강조용 */
export const DATAMOD_ACCENT = '#0077FF'

type DatamodWordmarkProps = {
  className?: string
  /** 텍스트 베이스 클래스 (기본: 소문자, 가독성 우선) */
  textClassName?: string
}

/**
 * Datamod 워드마크: 소문자 `datamod` + 마지막 `d`만 포인트 컬러.
 * ALL CAPS 대비 혼합 라틴+한글 UI에서 리듬이 자연스럽습니다.
 */
export function DatamodWordmark({ className, textClassName }: DatamodWordmarkProps) {
  return (
    <span className={cn('inline-flex items-baseline font-semibold tracking-tight', className)}>
      <span className={cn('text-inherit', textClassName)}>datamo</span>
      <span className="font-semibold" style={{ color: DATAMOD_ACCENT }}>
        d
      </span>
    </span>
  )
}
