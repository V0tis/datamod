import Parser from 'rss-parser'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }
const RSS_BASE = 'https://trends.google.com/trends/trendingsearches/daily/rss'
const STALE_MINUTES = 60

export type { TrendItem }

/** RSS item에 맞춘 커스텀 필드 (ht:approx_traffic 등) */
type RssParserItem = {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  isoDate?: string
  approxTraffic?: string
  [key: string]: unknown
}

const parser = new Parser<RssParserItem>({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:news_item', 'newsItem'],
    ],
  },
})

/** description 또는 content에서 검색량 수치 추출 (예: "1,000,000+ searches" / "Approximate number of searches" ) */
function extractSearchVolumeFromText(text: string | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/(\d[\d,.]*\+?)\s*(?:searches|searches|회|검색)/i)
  if (match) return match[1].trim()
  const plain = text.match(/(\d[\d,.]*\+?)/)
  return plain ? plain[1].trim() : null
}

/** description/content에서 연관 키워드·문구 추출 (쉼표·줄바꿈 구분, 태그 제거) */
function extractAnalysisKeywords(text: string | undefined): string[] {
  if (!text || typeof text !== 'string') return []
  const stripped = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped
    .split(/[,;|·\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 50)
    .slice(0, 10)
}

/** RSS 한 국가 피드를 파싱해 TrendItem[] 반환 */
async function fetchTrendsFromRss(geo: string): Promise<TrendItem[]> {
  const url = `${RSS_BASE}?geo=${geo}`
  const feed = await parser.parseURL(url)
  const items: TrendItem[] = []

  for (let i = 0; i < (feed.items?.length ?? 0) && i < 20; i++) {
    const it = feed.items[i] as RssParserItem | undefined
    if (!it) continue

    const keyword = (it.title ?? '').trim().replace(/\s+/g, ' ')
    if (!keyword || keyword.length < 2) continue

    const search_volume =
      (it.approxTraffic && String(it.approxTraffic).trim()) ||
      extractSearchVolumeFromText(it.content ?? it.contentSnippet) ||
      null

    const started_at =
      it.pubDate?.trim() || it.isoDate?.trim() || null

    const description = it.content ?? it.contentSnippet ?? ''
    const analysis_keywords = extractAnalysisKeywords(description)

    items.push({
      keyword,
      rank: items.length + 1,
      search_volume,
      started_at,
      analysis_keywords,
    })
  }

  return items
}

/** RSS로 국가별 트렌드 수집 후 global_trends에 upsert (기존 스키마 유지) */
export async function refreshGlobalTrends(): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[] }> {
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  const supabase = getSupabase()

  console.log('[Trends] Google 트렌드 RSS 수집 시작.', RSS_BASE)
  for (const [countryCode, geo] of Object.entries(COUNTRY_GEO)) {
    try {
      const url = `${RSS_BASE}?geo=${geo}`
      console.log('[Trends] 요청 URL:', url, '(countryCode:', countryCode, ')')
      const items = await fetchTrendsFromRss(geo)
      results[countryCode] = items
      console.log('[Trends] RSS 파싱 완료:', countryCode, '→', items.length, '개')

      if (items.length > 0) {
        console.dir(
          items.map((t) => ({ keyword: t.keyword, search_volume: t.search_volume, started_at: t.started_at })),
          { depth: 3 }
        )
      }

      await supabase.from('global_trends').delete().eq('country_code', countryCode)
      if (items.length > 0) {
        const rowsToInsert = items.map((t) => ({
          country_code: countryCode,
          keyword: t.keyword,
          rank: t.rank,
          search_volume: t.search_volume,
          started_at: t.started_at,
          analysis_keywords: t.analysis_keywords,
          created_at: new Date().toISOString(),
        }))
        const { error: insertError } = await supabase.from('global_trends').insert(rowsToInsert)
        if (insertError) {
          console.error('[Trends] global_trends insert error:', countryCode, insertError)
          throw insertError
        }
        console.log('Saved Data:', { country_code: countryCode, count: rowsToInsert.length })
      }
    } catch (e) {
      console.warn('[Trends] RSS 수집 실패:', countryCode, `${RSS_BASE}?geo=${geo}`, e)
      throw e
    }
  }
  console.log('[Trends] RSS 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length)
  return { KR: results.KR, US: results.US, JP: results.JP }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true */
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
