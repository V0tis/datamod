import { getSupabase } from '@/lib/supabase'
import type { TrendItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }
const TRENDS_URL = 'https://trends.google.com/trending'
const STALE_MINUTES = 60

export type { TrendItem }

/** 마크다운에서 트렌드명·검색량·시작시점·분석키워드 추출 (휴리스틱) */
function extractTrendItemsFromMarkdown(markdown: string): TrendItem[] {
  if (!markdown || typeof markdown !== 'string') return []
  const lines = markdown.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const items: TrendItem[] = []
  const seen = new Set<string>()

  const volumeRe = /(\d+[\d,.]*(?:만|K|M|k|m)?\+?)\s*(?:검색|search|회)/i
  const startedRe = /(\d+\s*(?:시간|일|분|주)\s*전|hours?|days? ago)/i
  const keywordLabelRe = /(?:관련|분석|키워드|related|keywords?)\s*[:\-]\s*(.+)/i

  for (let i = 0; i < lines.length && items.length < 10; i++) {
    const raw = lines[i]
    const line = raw.replace(/^#+\s*/, '').replace(/\s*\[.*?\]\(.*?\)\s*/g, '').trim()
    if (line.length < 2 || line.length > 80 || /^https?:\/\//i.test(line) || /^[\d.]+\s*$/.test(line)) continue
    const key = line.slice(0, 100)
    if (seen.has(key)) continue
    seen.add(key)

    let search_volume: string | null = null
    let started_at: string | null = null
    let analysis_keywords: string[] = []

    const volMatch = line.match(volumeRe) || (lines[i + 1] && lines[i + 1].match(volumeRe))
    if (volMatch) search_volume = volMatch[1].trim()
    const startMatch = line.match(startedRe) || (lines[i + 1] && lines[i + 1].match(startedRe))
    if (startMatch) started_at = startMatch[1].trim()
    const kwMatch = line.match(keywordLabelRe) || (lines[i + 1] && lines[i + 1].match(keywordLabelRe))
    if (kwMatch) {
      analysis_keywords = kwMatch[1]
        .split(/[,··]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 1 && s.length <= 50)
        .slice(0, 10)
    }

    items.push({
      keyword: line,
      rank: items.length + 1,
      search_volume,
      started_at,
      analysis_keywords,
    })
  }
  return items
}

/** Firecrawl으로 국가별 트렌드 크롤링 후 global_trends에 upsert (확장 스키마) */
export async function refreshGlobalTrends(): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[] }> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim()
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  const supabase = getSupabase()

  console.log('[Trends] Google 트렌드 페이지에서 데이터 수집 시작. URL:', TRENDS_URL)
  for (const [countryCode, geo] of Object.entries(COUNTRY_GEO)) {
    try {
      const url = `${TRENDS_URL}?geo=${geo}`
      console.log('[Trends] 요청 URL:', url, '(countryCode:', countryCode, ')')
      const res = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
          timeout: 25000,
          wait_for: 3000,
        }),
      })

      const contentType = res.headers.get('content-type') ?? ''
      const rawText = await res.text()
      if (!res.ok || !contentType.includes('application/json')) {
        const errMsg = rawText || res.statusText || `HTTP ${res.status}`
        console.warn('[Trends] Firecrawl 응답 실패 (HTML 또는 에러):', url, 'status:', res.status, 'content-type:', contentType, 'body:', rawText.slice(0, 500))
        throw new Error(errMsg)
      }
      let json: { success?: boolean; data?: { markdown?: string }; error?: string }
      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error(rawText || 'Firecrawl 응답 JSON 파싱 실패')
      }
      console.log('[Trends] Firecrawl response:', countryCode, 'success:', json?.success, 'data keys:', json?.data ? Object.keys(json.data) : null, 'error:', json?.error ?? 'none')
      const markdown = json?.data?.markdown ?? ''
      const markdownPreview = markdown.length > 2000 ? markdown.slice(0, 2000) + '\n\n... (이하 생략, 총 ' + markdown.length + '자)' : markdown
      console.log('[Trends] Firecrawl markdown 본문:\n' + '---\n' + markdownPreview + '\n---')
      const items = extractTrendItemsFromMarkdown(markdown)
      results[countryCode] = items
      console.log('[Trends] 수집 완료:', url, '→ 트렌드', items.length, '개', items.slice(0, 2).map((t) => t.keyword).join(', '), items.length > 2 ? '...' : '')

      await supabase.from('global_trends').delete().eq('country_code', countryCode)
      if (items.length > 0) {
        await supabase.from('global_trends').insert(
          items.map((t) => ({
            country_code: countryCode,
            keyword: t.keyword,
            rank: t.rank,
            search_volume: t.search_volume,
            started_at: t.started_at,
            analysis_keywords: t.analysis_keywords,
            created_at: new Date().toISOString(),
          }))
        )
      }
    } catch (e) {
      console.warn('[Trends] 수집 실패:', countryCode, `${TRENDS_URL}?geo=${geo}`, e)
      throw e
    }
  }
  console.log('[Trends] Google 트렌드 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length)
  return { KR: results.KR, US: results.US, JP: results.JP }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true (확장 스키마: country별 최신 created_at 기준) */
export function isTrendsStale(
  rows: { country_code: string; created_at: string | null }[],
  countryCodes: string[] = ['KR', 'US', 'JP']
): boolean {
  const now = Date.now()
  const staleMs = STALE_MINUTES * 60 * 1000
  const byCode = new Map<string, string | null>()
  for (const r of rows) {
    const cur = byCode.get(r.country_code)
    if (!cur || (r.created_at && r.created_at > cur)) byCode.set(r.country_code, r.created_at)
  }
  for (const code of countryCodes) {
    const at = byCode.get(code)
    if (!at) return true
    const t = new Date(at).getTime()
    if (now - t > staleMs) return true
  }
  return false
}
