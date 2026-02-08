import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }
const TRENDS_URL = 'https://trends.google.com/trending/explore'

/** 마크다운/텍스트에서 트렌드 키워드처럼 보이는 줄 추출 (2~80자, 링크/헤딩 제외) */
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

/** POST: Firecrawl으로 국가별 트렌드 페이지 크롤링 후 global_trends에 캐시 저장 */
export async function POST() {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim()
  if (!firecrawlKey) {
    return NextResponse.json(
      { error: 'FIRECRAWL_API_KEY가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  const supabase = getSupabase()
  const results: Record<string, string[]> = { KR: [], US: [], JP: [] }

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

      if (!res.ok) {
        console.warn(`[Trends Update] Firecrawl scrape failed for ${countryCode}:`, res.status)
        continue
      }

      const json = (await res.json()) as { success?: boolean; data?: { markdown?: string } }
      const markdown = json?.data?.markdown ?? ''
      const keywords = extractKeywordsFromMarkdown(markdown)
      results[countryCode] = keywords

      const { error } = await supabase.from('global_trends').upsert(
        {
          country_code: countryCode,
          keywords: keywords,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'country_code' }
      )
      if (error) console.error('[Trends Update] upsert error:', error)
    } catch (e) {
      console.error(`[Trends Update] ${countryCode}:`, e)
    }
  }

  return NextResponse.json({ success: true, updated: results })
}
