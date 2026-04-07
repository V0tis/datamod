/**
 * 인사이트 본문을 모달 섹션(핵심 요약 / 상세 배경 / 예상 효과)으로 나눕니다.
 */

export type InsightSections = {
  summary: string
  background: string
  effect: string
}

type Kind = 'summary' | 'background' | 'effect'

function headerKind(title: string): Kind {
  const x = title.replace(/\s+/g, '')
  if (/효과/.test(x)) return 'effect'
  if (/배경|맥락/.test(x)) return 'background'
  return 'summary'
}

const HEADER_RE =
  /(?:^|\n)(#{1,3})\s*(핵심\s*요약|요약|상세\s*배경|배경\s*및\s*맥락|배경|예상\s*효과|기대\s*효과|효과)\s*\n/gi

function parseByMarkdownHeaders(t: string): InsightSections | null {
  const matches: { hStart: number; hEnd: number; kind: Kind }[] = []
  let m: RegExpExecArray | null
  HEADER_RE.lastIndex = 0
  while ((m = HEADER_RE.exec(t)) !== null) {
    matches.push({
      hStart: m.index,
      hEnd: m.index + m[0].length,
      kind: headerKind(m[2]),
    })
  }
  if (matches.length === 0) return null

  const out: InsightSections = { summary: '', background: '', effect: '' }
  for (let i = 0; i < matches.length; i++) {
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].hStart : t.length
    const body = t.slice(matches[i].hEnd, bodyEnd).trim()
    const k = matches[i].kind
    if (k === 'summary') out.summary = [out.summary, body].filter(Boolean).join('\n\n')
    else if (k === 'background') out.background = [out.background, body].filter(Boolean).join('\n\n')
    else out.effect = [out.effect, body].filter(Boolean).join('\n\n')
  }

  return {
    summary: out.summary || t.slice(0, 240).trim(),
    background: out.background,
    effect: out.effect,
  }
}

export function parseInsightSections(raw: string): InsightSections {
  const t = raw.trim()
  if (!t) return { summary: '', background: '', effect: '' }

  const byHeaders = parseByMarkdownHeaders(t)
  if (byHeaders) return byHeaders

  const blocks = t.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  if (blocks.length >= 3) {
    return {
      summary: blocks[0],
      background: blocks.slice(1, -1).join('\n\n'),
      effect: blocks[blocks.length - 1],
    }
  }
  if (blocks.length === 2) {
    return { summary: blocks[0], background: blocks[1], effect: '' }
  }

  const one = blocks[0] ?? t
  const sentences = one.split(/(?<=[.!?。！？])\s+/).map((s) => s.trim()).filter(Boolean)
  if (sentences.length >= 4) {
    const n = sentences.length
    const a = Math.max(1, Math.floor(n / 3))
    const b = Math.max(a + 1, Math.floor((2 * n) / 3))
    return {
      summary: sentences.slice(0, a).join(' '),
      background: sentences.slice(a, b).join(' '),
      effect: sentences.slice(b).join(' '),
    }
  }
  if (sentences.length >= 2) {
    const mid = Math.ceil(sentences.length / 2)
    return {
      summary: sentences.slice(0, mid).join(' '),
      background: sentences.slice(mid).join(' '),
      effect: '',
    }
  }

  return { summary: one, background: '', effect: '' }
}
