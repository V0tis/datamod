/**
 * UTF-8/유니코드 정규화 및 흔한 깨짐(대체 문자, 일부 mojibake)만 보정.
 * 일본어·한글·라틴을 제거하지 않습니다 (sanitizeForKoreanDisplay 와 대비).
 */

const REPLACEMENT = /\uFFFD/g

/** Latin-1 로 잘못 읽힌 UTF-8 바이트 시퀀스에 대한 흔한 패턴 (부분 복구) */
const MOJIBAKE_SNIPPETS: Array<[RegExp, string]> = [
  [/Ã¢â‚¬â„¢/g, "'"],
  [/Ã¢â‚¬Å"/g, '"'],
  [/Ã¢â‚¬Å"/g, '"'],
  [/Ã¢â‚¬Â¢/g, '·'],
  [/â€"|â€“|â€"/g, '—'],
  [/Â·/g, '·'],
]

export function repairMultilingualText(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return ''
  let t = s.trim()
  if (!t) return ''
  try {
    t = t.normalize('NFC')
  } catch {
    /* ignore */
  }
  try {
    t = t.normalize('NFKC')
  } catch {
    /* ignore */
  }
  t = t.replace(REPLACEMENT, '')
  for (const [re, rep] of MOJIBAKE_SNIPPETS) {
    t = t.replace(re, rep)
  }
  return t.trim()
}
