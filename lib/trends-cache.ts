import { getSupabase } from '@/lib/supabase'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }
const TRENDS_URL = 'https://trends.google.com/trending/explore'
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

  for (const [countryCode, geo] of Object.entries(COUNTRY_GEO)) {
    try {
      const url = `${TRENDS_URL}?geo=${geo}`
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
        }),
      })
      if (!res.ok) continue
      const json = (await res.json()) as { success?: boolean; data?: { markdown?: string } }
      const markdown = json?.data?.markdown ?? ''
      const keywords = extractKeywordsFromMarkdown(markdown)
      results[countryCode] = keywords
      await supabase.from('global_trends').upsert(
        {
          country_code: countryCode,
          keywords: keywords,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'country_code' }
      )
    } catch {
      /* skip */
    }
  }

  return results
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
