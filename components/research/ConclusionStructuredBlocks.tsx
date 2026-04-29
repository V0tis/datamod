'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { MarkdownBody } from '@/components/ui/markdown-body'
import { stripLeadingMarkdownHeadings } from '@/lib/strip-markdown-heading-markers'
import { injectKeywordBold } from '@/lib/text-keyword-bold'

function titleLineLabel(line: string): string | null {
  const s = line.replace(/^#{1,6}\s*/, '').trim()
  if (/^배경(\s*및\s*근거)?$/i.test(s) || /^background$/i.test(s)) return '배경 및 근거'
  if (/^전략$/i.test(s) || /^strategy$/i.test(s)) return '전략'
  if (/^기대\s*효과$/i.test(s) || /^기대효과$/i.test(s) || /^expected/i.test(s)) return '기대 효과'
  return null
}

function displayBlockTitle(title: string): string {
  if (title === '전략') return '핵심 전략'
  if (title === '기대 효과') return '예상 효과'
  return title
}

/** `##` 제거 후 단독 줄 제목(배경/전략/기대 효과) 또는 단락 3분할 */
export function tryParseConclusionTriad(text: string): { title: string; body: string }[] | null {
  const t = stripLeadingMarkdownHeadings(text).trim()
  if (!t) return null

  const lines = t.split('\n')
  type Acc = { title: string; lines: string[] }
  const acc: Acc[] = []
  let cur: Acc | null = null
  const orphan: string[] = []
  for (const line of lines) {
    const label = titleLineLabel(line)
    if (label) {
      if (cur && cur.lines.join('\n').trim()) acc.push(cur)
      cur = { title: label, lines: [] }
    } else if (cur) {
      cur.lines.push(line)
    } else {
      orphan.push(line)
    }
  }
  if (cur && cur.lines.join('\n').trim()) acc.push(cur)

  if (acc.length >= 2) {
    const mapped = acc.map((b) => ({ title: b.title, body: b.lines.join('\n').trim() }))
    const head = orphan.join('\n').trim()
    if (head) {
      mapped[0] = { title: mapped[0].title, body: `${head}\n\n${mapped[0].body}`.trim() }
    }
    return mapped
  }

  const paras = t
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 12)
  if (paras.length >= 3) {
    return [
      { title: '배경 및 근거', body: paras[0] },
      { title: '전략', body: paras[1] },
      { title: '기대 효과', body: paras.slice(2).join('\n\n') },
    ]
  }
  return null
}

const bodyTypography = 'text-[15px] leading-[1.65] tracking-wide text-pretty text-slate-700 [word-break:keep-all] '

function renderInlineBold(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900 ">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

/** 불릿/번호 줄·단락을 항목으로 분리(표시용으로 #,* 접두 제거) */
function bodyToItems(body: string): string[] {
  const stripped = stripLeadingMarkdownHeadings(body).trim()
  if (!stripped) return []

  const oneLine = (s: string) =>
    s
      .split('\n')
      .map((l) =>
        l
          .replace(/^#{1,6}\s*/, '')
          .replace(/^[-*•]\s+/, '')
          .replace(/^\d+[.)]\s+/, '')
          .trim()
      )
      .filter(Boolean)
      .join(' ')
      .trim()

  if (stripped.includes('\n\n')) {
    return stripped
      .split(/\n\n+/)
      .map((p) => oneLine(p))
      .filter(Boolean)
  }

  const lines = stripped
    .split('\n')
    .map((l) =>
      l
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .trim()
    )
    .filter(Boolean)
  return lines.length ? lines : [oneLine(stripped)].filter(Boolean)
}

function TriadSectionBody({
  blockTitle,
  body,
  highlightTerms,
}: {
  blockTitle: string
  body: string
  highlightTerms: string[]
}) {
  const items = bodyToItems(body)
  const highlightedItems = items.map((line) => injectKeywordBold(line, highlightTerms))

  if (blockTitle === '배경 및 근거') {
    return (
      <dl className={cn('space-y-3', bodyTypography)}>
        {highlightedItems.map((line, i) => (
          <div key={i} className="border-l-2 border-slate-200 pl-3 ">
            <dt className="sr-only">근거 {i + 1}</dt>
            <dd className="m-0">{renderInlineBold(line)}</dd>
          </div>
        ))}
      </dl>
    )
  }

  if (blockTitle === '전략') {
    return (
      <ul className="m-0 list-none space-y-2.5 p-0">
        {highlightedItems.map((line, i) => (
          <li key={i} className={cn('flex gap-2.5', bodyTypography)}>
            <span className="mt-0.5 shrink-0 font-mono text-xs font-bold text-sky-600 " aria-hidden>
              ·
            </span>
            <span className="min-w-0 flex-1">{renderInlineBold(line)}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (blockTitle === '기대 효과') {
    return (
      <aside
        className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-4 py-3.5  "
        aria-label="예상 효과"
      >
        <dl className={cn('m-0 space-y-2.5', bodyTypography)}>
          {highlightedItems.map((line, i) => (
            <div key={i}>
              <dt className="sr-only">효과 {i + 1}</dt>
              <dd className="m-0 text-emerald-950 ">{renderInlineBold(line)}</dd>
            </div>
          ))}
        </dl>
      </aside>
    )
  }

  return (
    <MarkdownBody className={cn('prose-base max-w-none ', bodyTypography)}>
      {injectKeywordBold(body, highlightTerms)}
    </MarkdownBody>
  )
}

export function ConclusionStructuredBlocks({
  markdown,
  highlightTerms,
  className,
}: {
  markdown: string
  highlightTerms: string[]
  className?: string
}) {
  const cleaned = stripLeadingMarkdownHeadings(markdown)
  const triad = tryParseConclusionTriad(cleaned)

  if (!triad || triad.length < 2) {
    const highlighted = injectKeywordBold(cleaned, highlightTerms)
    return (
      <MarkdownBody
        className={cn(
          'prose-base max-w-none text-slate-700  ',
          'leading-[1.65] tracking-wide text-pretty [word-break:keep-all]',
          className
        )}
      >
        {highlighted}
      </MarkdownBody>
    )
  }

  return (
    <div className={cn('grid gap-5 sm:grid-cols-1 md:grid-cols-3 md:gap-6', className)}>
      {triad.map((block, i) => (
        <section
          key={`${block.title}-${i}`}
          className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm  "
        >
          <h4 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold tracking-tight text-slate-900  ">
            {displayBlockTitle(block.title)}
          </h4>
          <TriadSectionBody blockTitle={block.title} body={block.body} highlightTerms={highlightTerms} />
        </section>
      ))}
    </div>
  )
}
