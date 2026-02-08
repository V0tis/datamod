'use client'

import Link from 'next/link'

/**
 * 마크다운 형식 텍스트를 렌더링하며, **강조**된 키워드를 클릭 시 린 검색(/results?keyword=...)으로 연결합니다.
 */
export function MarkdownWithSearchLinks({ text }: { text: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/)
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((segment, i) =>
        i % 2 === 1 ? (
          <Link
            key={i}
            href={`/results?keyword=${encodeURIComponent(segment.trim())}`}
            className="font-semibold text-primary hover:underline"
          >
            {segment}
          </Link>
        ) : (
          <span key={i}>{segment}</span>
        )
      )}
    </span>
  )
}
