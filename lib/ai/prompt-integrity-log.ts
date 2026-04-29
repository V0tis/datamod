/**
 * Server-side diagnostics: RSS → COLLECTED_DATA → user prompt size & truncation hints.
 * Tags: [DATA_CHECK], [PROMPT_CHECK], [WARNING]
 */
import type { DataDrivenSections } from './base-prompt'
import { formatCollectedData } from './base-prompt'

const COLLECTED_MARKER = 'COLLECTED_DATA:\n'
const TASK_MARKER = '\n\nTASK:\n'

export function lengthOfInjectedCollectedBlock(prompt: string): number | null {
  const i = prompt.indexOf(COLLECTED_MARKER)
  if (i < 0) return null
  const start = i + COLLECTED_MARKER.length
  const taskAt = prompt.indexOf(TASK_MARKER, start)
  if (taskAt < 0) return null
  return taskAt - start
}

export type NewsLike = { title?: string }

/** After RSS fetch: count, title array, empty/null warnings. */
export function logRssNewsCollectionCheck(
  news: NewsLike[] | null | undefined,
  keyword: string,
  meta?: { resumed?: boolean }
): void {
  const resumed = meta?.resumed === true
  if (news == null) {
    console.warn('[WARNING] [DATA_CHECK] RSS 수집 결과가 null/undefined입니다.', { keyword, resumed })
    return
  }
  const titles = news.map((n) => (typeof n.title === 'string' ? n.title : ''))
  if (news.length === 0) {
    console.warn('[WARNING] [DATA_CHECK] 검색 결과가 0건입니다.', { keyword, resumed })
  }
  if (news.length > 0 && news.length < 3) {
    console.warn('[WARNING] 분석 데이터가 3건 미만입니다. 인사이트 품질이 저하될 수 있습니다.', {
      keyword,
      count: news.length,
      resumed,
    })
  }
}

export function logDataDrivenPromptInjection(opts: {
  phase: string
  keyword: string
  prompt: string
  sections: DataDrivenSections
  /** e.g. sum of article `content` lengths before summarization (contrast with serialized summaries). */
  originalSourceChars?: number
}): void {
  const { phase, keyword, prompt, sections, originalSourceChars } = opts
  const assembledBeforePrompt = formatCollectedData(sections)
  const assembledLen = assembledBeforePrompt.length
  const injectedLen = lengthOfInjectedCollectedBlock(prompt)
  const totalLen = prompt.length
  const approxTokens = Math.ceil(totalLen / 4)

  let integrityNote: string
  if (assembledLen === 0) {
    integrityNote = injectedLen === 0 || injectedLen == null ? 'COLLECTED_DATA 없음' : '검증 필요'
  } else if (injectedLen != null && injectedLen === assembledLen) {
    integrityNote = '유실 없음'
  } else if (injectedLen != null && injectedLen < assembledLen) {
    integrityNote = `잘림 의심 (프롬프트 내 COLLECTED 블록 ${injectedLen.toLocaleString()}자 < 조립 데이터 ${assembledLen.toLocaleString()}자)`
  } else {
    integrityNote = '마커 파싱 실패·검증 불가'
  }

  const origPart =
    originalSourceChars != null
      ? ` | 추출 본문 합(요약 전): ${originalSourceChars.toLocaleString()}자`
      : ''

  const injectedDisplay = injectedLen == null ? 'N/A' : injectedLen.toLocaleString()

  console.info(
    `[PROMPT_CHECK] ${phase} | keyword=${keyword} | 프롬프트 총 ${totalLen.toLocaleString()}자 | 토큰 근사(÷4): ~${approxTokens.toLocaleString()}`
  )
  console.info(
    `[PROMPT_CHECK] 프롬프트 주입 데이터 길이: ${injectedDisplay}자 / 원본 데이터 길이: ${assembledLen.toLocaleString()}자 (${integrityNote})${origPart}`
  )
  if (originalSourceChars != null && originalSourceChars > 0 && assembledLen < originalSourceChars) {
    console.info(
      '[PROMPT_CHECK] 참고: 조립 데이터가 추출 본문 합보다 짧음 — 요약·추출 단계에서 압축된 경우가 많음(프롬프트 잘림과는 별개).'
    )
  }
}
