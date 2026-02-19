/**
 * Streaming analysis prompt with section markers.
 * Output format: [SUMMARY]...[TEMPERATURE]...[INSIGHT]...[ACTION]
 * Client parses accumulated text to extract sections progressively.
 */
export const STREAM_ANALYSIS_SYSTEM = `뉴스 기반 시장 분석. 반드시 아래 형식으로만 출력. 마커 순서 고정.
[SUMMARY]
한 줄 요약 (1문장)

[TEMPERATURE]
0-100 숫자 하나

[INSIGHT]
- fact 1
- fact 2
- hypothesis (가설)
- inference (추론)

[ACTION]
- 제목|이유|urgency
- 제목2|이유2|urgency
urgency: low, medium, high 중 하나.`

export function buildStreamAnalysisPrompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length
    ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
    : ''
  return `${block}"${keyword}" 시장 분석. [SUMMARY]부터 [ACTION]까지 순서대로 작성.`
}

export type ParsedSections = {
  summary: string
  temperature: number
  insightLines: string[]
  actionLines: Array<{ title: string; reasoning: string; urgency: 'low' | 'medium' | 'high' }>
}

function extractSection(
  text: string,
  startMarker: string,
  endMarker: string | null
): string {
  const start = text.indexOf(startMarker)
  if (start < 0) return ''
  const contentStart = start + startMarker.length
  const slice = text.slice(contentStart)
  if (!endMarker) return slice.trim()
  const end = slice.indexOf(endMarker)
  return (end >= 0 ? slice.slice(0, end) : slice).trim()
}

/**
 * Parse accumulated stream text into sections.
 * Handles partial markers (e.g. "[SUM" not yet "[SUMMARY]").
 */
export function parseStreamSections(accumulated: string): Partial<ParsedSections> {
  const result: Partial<ParsedSections> = {}

  const summary = extractSection(accumulated, '[SUMMARY]', '[TEMPERATURE]')
  if (summary) {
    result.summary = summary
  }

  const tempStr = extractSection(accumulated, '[TEMPERATURE]', '[INSIGHT]')
  if (tempStr) {
    const num = parseInt(tempStr, 10)
    if (!isNaN(num)) result.temperature = Math.min(100, Math.max(0, num))
  }

  const insightBlock = extractSection(accumulated, '[INSIGHT]', '[ACTION]')
  if (insightBlock) {
    result.insightLines = insightBlock
      .split('\n')
      .map((s) => s.replace(/^-\s*/, '').trim())
      .filter(Boolean)
  }

  const actionBlock = extractSection(accumulated, '[ACTION]', null)
  if (actionBlock) {
    result.actionLines = actionBlock
      .split('\n')
      .map((line) => {
        const t = line.replace(/^-\s*/, '').trim()
        if (!t) return null
        const parts = t.split('|')
        const title = parts[0]?.trim() ?? ''
        const reasoning = parts[1]?.trim() ?? ''
        const urg = (parts[2]?.trim() ?? 'low') as string
        const urgency =
          urg === 'high' || urg === 'medium' || urg === 'low' ? urg : 'low'
        return { title, reasoning, urgency }
      })
      .filter((a): a is { title: string; reasoning: string; urgency: 'low' | 'medium' | 'high' } => a !== null && a.title.length > 0)
  }

  return result
}
