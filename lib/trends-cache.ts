import Parser from 'rss-parser'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }

/** 범용 Google Trends RSS 엔드포인트 (404 방지용) */
const RSS_BASE = 'https://trends.google.com/trending/rss'

const STALE_MINUTES = 60

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ACCEPT_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  KR: 'ko-KR,ko;q=0.9,en;q=0.8',
  US: 'en-US,en;q=0.9',
  JP: 'ja-JP,ja;q=0.9,en;q=0.8',
}

/** RSS 요청 실패 시 API/클라이언트에서 토스트 등에 노출할 상세 정보 */
export class TrendsFetchError extends Error {
  constructor(
    message: string,
    public readonly countryCode: string,
    public readonly attemptedUrls: string[]
  ) {
    super(message)
    this.name = 'TrendsFetchError'
  }
}

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

/** Google 메뉴/UI 텍스트 등 키워드로 쓰이면 안 되는 문자열 (대소문자 무시) */
const KEYWORD_BLACKLIST = new Set([
  'home', 'explore', 'trending', 'search', 'more', 'all', 'news', 'sports',
  'entertainment', 'default', 'unknown', '—', '–', '-', '',
])

function isBlacklistedKeyword(keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  return KEYWORD_BLACKLIST.has(k) || k.length < 2
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
    .filter((s) => s.length >= 2 && s.length <= 50 && !KEYWORD_BLACKLIST.has(s.toLowerCase()))
    .slice(0, 10)
}

/** 국가 코드에 맞는 Accept-Language 값 */
function getAcceptLanguage(countryCode: string): string {
  return ACCEPT_LANGUAGE_BY_COUNTRY[countryCode] ?? 'en-US,en;q=0.9'
}

/** 헤더를 붙여 RSS URL fetch 후 XML 문자열 반환. 404 등이면 throw. */
async function fetchRssXml(url: string, countryCode: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': getAcceptLanguage(countryCode),
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  })
  if (!res.ok) {
    const err = new Error(`RSS 요청 실패: ${res.status} ${res.statusText}`) as Error & { status?: number; url?: string }
    err.status = res.status
    err.url = url
    throw err
  }
  return res.text()
}

/** 시도할 URL 목록: 1) geo= 2) 해당 국가만 ed= fallback */
function getUrlsForCountry(countryCode: string): string[] {
  const upper = countryCode.toUpperCase()
  const lower = countryCode.toLowerCase()
  return [
    `${RSS_BASE}?geo=${upper}`,
    `${RSS_BASE}?ed=${lower}`,
  ]
}

/** RSS 한 국가 피드를 파싱해 TrendItem[] 반환. 실패 시 TrendsFetchError (attemptedUrls 포함). */
async function fetchTrendsFromRss(countryCode: string): Promise<TrendItem[]> {
  const urls = getUrlsForCountry(countryCode)
  let lastError: Error | null = null

  for (const url of urls) {
    try {
      const xml = await fetchRssXml(url, countryCode)
      const feed = await parser.parseString(xml)
      const items: TrendItem[] = []

      for (let i = 0; i < (feed.items?.length ?? 0) && i < 20; i++) {
        const it = feed.items[i] as RssParserItem | undefined
        if (!it) continue

        const keyword = (it.title ?? '').trim().replace(/\s+/g, ' ')
        if (isBlacklistedKeyword(keyword)) continue

        const search_volume =
          (it.approxTraffic && String(it.approxTraffic).trim()) ||
          extractSearchVolumeFromText(it.content ?? it.contentSnippet) ||
          null

        const started_at = it.pubDate?.trim() || it.isoDate?.trim() || null

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
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const status = (lastError as Error & { status?: number }).status
      if (status === 404 || status === 403) {
        continue
      }
      throw new TrendsFetchError(lastError.message, countryCode, urls)
    }
  }

  throw new TrendsFetchError(
    lastError?.message ?? 'RSS 요청 실패',
    countryCode,
    urls
  )
}

/** RSS로 국가별 트렌드 수집 후 global_trends에 upsert (기존 스키마 유지). 실패 시 TrendsFetchError로 countryCode/attemptedUrls 전달. */
export async function refreshGlobalTrends(): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[] }> {
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  const supabase = getSupabase()

  console.log('[Trends] Google 트렌드 RSS 수집 시작.', RSS_BASE)
  for (const [countryCode] of Object.entries(COUNTRY_GEO)) {
    try {
      const urls = getUrlsForCountry(countryCode)
      console.log('[Trends] countryCode:', countryCode, 'URLs:', urls)
      const items = await fetchTrendsFromRss(countryCode)
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
      if (e instanceof TrendsFetchError) {
        console.warn('[Trends] RSS 수집 실패:', e.countryCode, e.attemptedUrls, e.message)
        throw e
      }
      console.warn('[Trends] RSS 수집 실패:', countryCode, e)
      throw new TrendsFetchError(
        e instanceof Error ? e.message : String(e),
        countryCode,
        getUrlsForCountry(countryCode)
      )
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
