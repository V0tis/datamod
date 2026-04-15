/**
 * AI가 반환한 마크다운을 화면 표시용으로 정리합니다.
 * - ATX 제목(`#`~`######`) 뒤 공백 누락 보정
 * - 제목 줄 끝의 불필요한 `#` 제거
 */
export function normalizeAiMarkdownForDisplay(raw: string): string {
  if (!raw) return ''
  const lines = raw.split('\n')
  const out: string[] = []
  for (const line of lines) {
    const m = line.match(/^(\s*)(#{1,6})(\s*)(.*)$/)
    if (m) {
      const level = m[2].length
      let rest = (m[4] ?? '').trim()
      rest = rest.replace(/\s+#+\s*$/, '').trim()
      out.push(`${'#'.repeat(level)} ${rest}`)
    } else {
      out.push(line)
    }
  }
  return out.join('\n')
}
