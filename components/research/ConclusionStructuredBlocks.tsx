'use client'

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

  const paras = t.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 12)
  if (paras.length >= 3) {
    return [
      { title: '배경 및 근거', body: paras[0] },
      { title: '전략', body: paras[1] },
      { title: '기대 효과', body: paras.slice(2).join('\n\n') },
    ]
  }
  return null
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
        className={cn('prose-base max-w-none leading-loose text-slate-700 dark:prose-invert dark:text-zinc-300', className)}
      >
        {highlighted}
      </MarkdownBody>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-1 md:grid-cols-3 md:gap-6', className)}>
      {triad.map((block, i) => (
        <div
          key={`${block.title}-${i}`}
          className="rounded-lg border border-slate-100 bg-white p-5 shadow-none dark:border-zinc-800 dark:bg-zinc-900/50"
        >
          <h4 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900 dark:border-zinc-800 dark:text-zinc-50">
            {block.title}
          </h4>
          <div className="prose prose-sm mt-3 max-w-none dark:prose-invert">
            <MarkdownBody className="text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
              {injectKeywordBold(block.body, highlightTerms)}
            </MarkdownBody>
          </div>
        </div>
      ))}
    </div>
  )
}
