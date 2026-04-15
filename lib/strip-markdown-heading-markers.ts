/** 마크다운 헤딩 마커(## 등)가 본문에 그대로 보이지 않도록 제거 */
export function stripLeadingMarkdownHeadings(text: string): string {
  return text.replace(/^#{1,6}\s+/gm, '').trim()
}
