/** 마크다운 본문에서 용어 첫 등장만 **볼드** 처리 (이미 감싸진 경우 건너뜀). */
export function injectKeywordBold(markdown: string, terms: string[]): string {
  let s = markdown
  for (const raw of terms) {
    const t = raw?.trim()
    if (!t || t.length < 2) continue
    if (s.includes(`**${t}**`)) continue
    const idx = s.indexOf(t)
    if (idx === -1) continue
    const before = s.slice(Math.max(0, idx - 2), idx)
    if (before === '**') continue
    s = s.slice(0, idx) + `**${t}**` + s.slice(idx + t.length)
  }
  return s
}
