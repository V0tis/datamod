import Parser from 'rss-parser'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem, TrendNewsItem, TrendNewsItemKo } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = {
  KR: 'KR',
  US: 'US',
  JP: 'JP',
  TW: 'TW',
  HK: 'HK',
  GB: 'GB',
  DE: 'DE',
}

/** 구글 트렌드 RSS (한국 도메인, geo 파라미터) */
const RSS_BASE = 'https://trends.google.co.kr/trending/rss'

const STALE_MINUTES = 60

export type TrendSourceType = 'RSS'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ACCEPT_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  KR: 'ko-KR,ko;q=0.9,en;q=0.8',
  US: 'en-US,en;q=0.9',
  JP: 'ja-JP,ja;q=0.9,en;q=0.8',
  TW: 'zh-TW,zh;q=0.9,en;q=0.8',
  HK: 'zh-HK,zh;q=0.9,en;q=0.8',
  GB: 'en-GB,en;q=0.9',
  DE: 'de-DE,de;q=0.9,en;q=0.8',
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

/** RSS item: title, ht:picture, ht:approx_traffic, ht:news_item_* 등 */
type RssParserItem = {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  description?: string
  isoDate?: string
  approxTraffic?: string
  picture?: string
  newsItemTitle?: string
  newsItemUrl?: string
  newsItemSource?: string
  newsItemPicture?: string
  [key: string]: unknown
}

const parser = new Parser<RssParserItem>({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:picture', 'picture'],
      ['ht:news_item_title', 'newsItemTitle'],
      ['ht:news_item_url', 'newsItemUrl'],
      ['ht:news_item_source', 'newsItemSource'],
      ['ht:news_item_picture', 'newsItemPicture'],
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

const DEFAULT_HOURS = 24

/** RSS URL: https://trends.google.co.kr/trending/rss?geo=${countryCode} */
function getRssUrlsForCountry(countryCode: string): string[] {
  const geo = countryCode.toUpperCase()
  return [`${RSS_BASE}?geo=${geo}`]
}

const TRANSLATE_TIMEOUT_MS = 25000

/**
 * geo !== 'KR'일 때 키워드·뉴스 제목을 한국어로 번역해 title_ko, news_items_ko 채움.
 * 에러/타임아웃 시 원문 그대로 저장.
 */
async function translateTrendsToKo(items: TrendItem[], countryCode: string): Promise<TrendItem[]> {
  const isKr = countryCode.toUpperCase() === 'KR'
  if (isKr) {
    return items.map((t) => ({
      ...t,
      title_ko: t.keyword,
      news_items_ko: (t.news_items ?? []).map((n) => ({ ...n, title_ko: n.title })),
    }))
  }

  const keywordTexts = items.map((i) => i.keyword)
  const newsEntries: { itemIndex: number; newsIndex: number; title: string }[] = []
  items.forEach((item, i) => {
    (item.news_items ?? []).forEach((n, j) => {
      newsEntries.push({ itemIndex: i, newsIndex: j, title: n.title || '관련 기사' })
    })
  })
  const newsTexts = newsEntries.map((e) => e.title)
  const allTexts = [...keywordTexts, ...newsTexts]
  if (allTexts.length === 0) {
    return items.map((t) => ({
      ...t,
      title_ko: t.keyword,
      news_items_ko: (t.news_items ?? []).map((n) => ({ ...n, title_ko: n.title })),
    }))
  }

  let translated: { text: string }[] = []
  try {
    const translate = (await import('google-translate-api-next')).default
    const result = await Promise.race([
      translate(allTexts, { to: 'ko', client: 'gtx' as const }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('translate_timeout')), TRANSLATE_TIMEOUT_MS)),
    ])
    translated = Array.isArray(result) ? result : [result]
  } catch {
    translated = allTexts.map((text) => ({ text }))
  }

  const nKeywords = keywordTexts.length
  let newsOffset = 0
  return items.map((t, i) => {
    const title_ko = translated[i]?.text ?? t.keyword
    const news_items_ko: TrendNewsItemKo[] = (t.news_items ?? []).map((n, j) => {
      const title_ko_j = translated[nKeywords + newsOffset + j]?.text ?? n.title
      return { title: n.title, title_ko: title_ko_j, url: n.url, source: n.source, image: n.image }
    })
    newsOffset += t.news_items?.length ?? 0
    return { ...t, title_ko, news_items_ko }
  })
}

/** RSS 한 국가 피드를 파싱해 TrendItem[] 반환. 실패 시 TrendsFetchError (attemptedUrls 포함). */
async function fetchTrendsFromRss(countryCode: string): Promise<TrendItem[]> {
  const urls = getRssUrlsForCountry(countryCode)
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
          extractSearchVolumeFromText(it.content ?? it.contentSnippet ?? it.description) ||
          null

        const started_at = it.pubDate?.trim() || it.isoDate?.trim() || null

        const description = it.description ?? it.content ?? it.contentSnippet ?? ''
        let analysis_keywords = extractAnalysisKeywords(description)
        if (it.newsItemTitle && typeof it.newsItemTitle === 'string' && it.newsItemTitle.trim().length >= 2) {
          analysis_keywords = [...analysis_keywords, it.newsItemTitle.trim()].slice(0, 10)
        }

        const picture_url = (it.picture && String(it.picture).trim()) || null
        const news_items: TrendNewsItem[] = []
        const title = (it.newsItemTitle && String(it.newsItemTitle).trim()) || ''
        const url = (it.newsItemUrl && String(it.newsItemUrl).trim()) || ''
        const source = (it.newsItemSource && String(it.newsItemSource).trim()) || undefined
        const image = (it.newsItemPicture && String(it.newsItemPicture).trim()) || undefined
        if (title || url) {
          news_items.push({ title: title || '관련 기사', url: url || '#', source, image })
        }

        items.push({
          keyword,
          rank: items.length + 1,
          search_volume,
          started_at,
          analysis_keywords,
          picture_url,
          news_items,
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

/** trend_status 테이블에 출처·갱신 시각 기록 (upsert) */
async function upsertTrendStatus(
  supabase: ReturnType<typeof getSupabase>,
  countryCode: string,
  sourceType: TrendSourceType,
  targetHours: number
): Promise<void> {
  const now = new Date().toISOString()
  await supabase.from('trend_status').upsert(
    {
      country_code: countryCode,
      source_type: sourceType,
      last_updated_at: now,
      target_hours: targetHours,
    },
    { onConflict: 'country_code' }
  )
}

/**
 * RSS 전용 수집. 저장 대상은 DB 테이블 global_trends (RPC upsert_country_trends가 DELETE 후 INSERT).
 * p_rows에 picture_url, title_ko, news_items_ko 포함 필수. trend_status에 출처·갱신 시각 기록.
 */
export async function refreshGlobalTrends(hours: number = DEFAULT_HOURS): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[]; TW: TrendItem[]; HK: TrendItem[]; GB: TrendItem[]; DE: TrendItem[] }> {
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [], TW: [], HK: [], GB: [], DE: [] }
  const supabase = getSupabase()

  console.log('[Trends] 수집 시작. RSS 전용, hours=', hours)
  for (const [countryCode] of Object.entries(COUNTRY_GEO)) {
    const items = await fetchTrendsFromRss(countryCode)
    const itemsWithKo = await translateTrendsToKo(items, countryCode)
    results[countryCode] = itemsWithKo

    const rowsForRpc = itemsWithKo.map((t) => ({
      keyword: t.keyword,
      rank: t.rank,
      search_volume: t.search_volume,
      started_at: t.started_at,
      analysis_keywords: t.analysis_keywords,
      picture_url: t.picture_url ?? null,
      news_items: t.news_items ?? [],
      title_ko: t.title_ko ?? null,
      news_items_ko: t.news_items_ko ?? [],
      created_at: new Date().toISOString(),
    }))
    const { error: rpcError } = await supabase.rpc('upsert_country_trends', {
      p_country_code: countryCode,
      p_rows: rowsForRpc,
    })
    if (rpcError) {
      console.error('[Trends] upsert_country_trends error:', countryCode, rpcError)
      throw rpcError
    }
    await upsertTrendStatus(supabase, countryCode, 'RSS', hours)
    if (itemsWithKo.length > 0) console.log('Saved:', { country_code: countryCode, count: itemsWithKo.length, source_type: 'RSS' })
  }
  console.log('[Trends] 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length, 'TW:', results.TW.length, 'HK:', results.HK.length, 'GB:', results.GB.length, 'DE:', results.DE.length)
  return {
    KR: results.KR,
    US: results.US,
    JP: results.JP,
    TW: results.TW,
    HK: results.HK,
    GB: results.GB,
    DE: results.DE,
  }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true */
export function isTrendsStale(
  rows: { country_code: string; created_at: string | null }[],
  countryCodes: string[] = ['KR', 'US', 'JP', 'TW', 'HK', 'GB', 'DE']
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
