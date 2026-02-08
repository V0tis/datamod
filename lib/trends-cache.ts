import { getSupabase } from '@/lib/supabase'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }
const TRENDS_URL = 'https://trends.google.com/trending'
const STALE_MINUTES = 60

function extractKeywordsFromMarkdown(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') return []
  const lines = markdown
    .split(/\n/)
    .map((l) => l.replace(/^#+\s*/, '').replace(/\s*\[.*?\]\(.*?\)\s*/g, '').trim())
    .filter((l) => l.length >= 2 && l.length <= 80 && !/^https?:\/\//i.test(l) && !/^[\d.]+\s*$/.test(l))
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const key = line.slice(0, 100)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
    if (out.length >= 10) break
  }
  return out
}

/** Firecrawl으로 국가별 트렌드 크롤링 후 global_trends에 upsert (공유 캐시 갱신) */
export async function refreshGlobalTrends(): Promise<{
  KR: string[]
  US: string[]
  JP: string[]
}> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim()
  const results: Record<string, string[]> = { KR: [], US: [], JP: [] }
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
      const keywords = extractKeywordsFromMarkdown(markdown)
      results[countryCode] = keywords
      console.log('[Trends] 수집 완료:', url, '→ 키워드', keywords.length, '개', keywords.slice(0, 3).join(', '), keywords.length > 3 ? '...' : '')
      await supabase.from('global_trends').upsert(
        {
          country_code: countryCode,
          keywords: keywords,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'country_code' }
      )
    } catch (e) {
      console.warn('[Trends] 수집 실패:', countryCode, `${TRENDS_URL}?geo=${geo}`, e)
      throw e
    }
  }
  console.log('[Trends] Google 트렌드 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length)
  return { KR: results.KR, US: results.US, JP: results.JP }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true */
export function isTrendsStale(
  rows: { country_code: string; created_at: string | null }[],
  countryCodes: string[] = ['KR', 'US', 'JP']
): boolean {
  const now = Date.now()
  const staleMs = STALE_MINUTES * 60 * 1000
  const byCode = new Map(rows.map((r) => [r.country_code, r.created_at]))
  for (const code of countryCodes) {
    const at = byCode.get(code)
    if (!at) return true
    const t = new Date(at).getTime()
    if (now - t > staleMs) return true
  }
  return false
}
