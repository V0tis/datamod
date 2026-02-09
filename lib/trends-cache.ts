import Parser from 'rss-parser'
import googleTrends from 'google-trends-api'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }

/** RSS 폴백: 구글 트렌드 RSS (geo만) */
const RSS_BASE = 'https://trends.google.com/trending/rss'

/** API 응답 앞에 붙는 XSS 방지 접두어 (라이브러리 raw 응답 시) */
const JSON_PREFIX = ")]}'\n"

const STALE_MINUTES = 60

export type TrendSourceType = 'API' | 'RSS'

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

/** hl = 응답 언어(인터페이스/라벨). geo는 트렌드 지역, hl은 결과 텍스트 언어. 나라별로 맞춤. */
const HL_BY_COUNTRY: Record<string, string> = {
  KR: 'ko',
  US: 'en',
  JP: 'ja',
}
function getHlForCountry(countryCode: string): string {
  return HL_BY_COUNTRY[countryCode.toUpperCase()] ?? 'en'
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

/** RSS 시도 URL 목록 (폴백용, geo만) */
function getRssUrlsForCountry(countryCode: string): string[] {
  const upper = countryCode.toUpperCase()
  const lower = countryCode.toLowerCase()
  return [
    `${RSS_BASE}?geo=${upper}`,
    `${RSS_BASE}?ed=${lower}`,
  ]
}

/** 라이브러리 응답이 문자열이면 )]}'\n 제거 후 파싱 */
function parseGoogleTrendsResponse(res: string | unknown): Record<string, unknown> | null {
  if (typeof res === 'object' && res !== null) return res as Record<string, unknown>
  if (typeof res !== 'string') return null
  let raw = res.trim()
  if (raw.startsWith(JSON_PREFIX)) raw = raw.slice(JSON_PREFIX.length).trim()
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** realTimeTrends 응답에서 storySummaries.trendingStories → TrendItem[] */
function mapRealTimeStoriesToItems(data: Record<string, unknown>): TrendItem[] {
  const items: TrendItem[] = []
  const storySummaries = data.storySummaries as Record<string, unknown> | undefined
  const stories = storySummaries?.trendingStories as Array<Record<string, unknown>> | undefined
  if (!Array.isArray(stories)) return items
  for (let i = 0; i < stories.length && i < 50; i++) {
    const s = stories[i]
    const firstArticle = Array.isArray(s.articles) ? (s.articles as Record<string, unknown>[])[0] : undefined
    const title = (s.title ?? s.entityTitle ?? s.name ?? (firstArticle?.title as string | undefined)) as string | undefined
    const keyword = typeof title === 'string' ? title.trim().replace(/\s+/g, ' ') : ''
    if (keyword.length < 2 || isBlacklistedKeyword(keyword)) continue
    items.push({
      keyword,
      rank: items.length + 1,
      search_volume: (s.formattedTraffic ?? s.approximateTraffic) != null ? String(s.formattedTraffic ?? s.approximateTraffic) : null,
      started_at: (s.time ?? s.publishedTime) != null ? String(s.time ?? s.publishedTime) : null,
      analysis_keywords: [],
    })
  }
  return items
}

/** dailyTrends 응답: default.trendingSearchesDays[0].trendingSearches → TrendItem[] */
function mapDailyTrendsToItems(data: Record<string, unknown>): TrendItem[] {
  const items: TrendItem[] = []
  const def = data.default as Record<string, unknown> | undefined
  const days = def?.trendingSearchesDays as Array<{ trendingSearches?: Array<Record<string, unknown>> }> | undefined
  const firstDay = Array.isArray(days) ? days[0] : undefined
  const list = firstDay?.trendingSearches
  if (!Array.isArray(list)) return items
  for (let i = 0; i < list.length && i < 50; i++) {
    const o = list[i]
    const title = o.title as Record<string, string> | string | undefined
    const keyword = typeof title === 'string'
      ? title
      : (title && typeof title === 'object' && typeof title.query === 'string')
        ? title.query
        : (o.query as string) ?? (o.name as string) ?? ''
    const cleaned = keyword.trim().replace(/\s+/g, ' ')
    if (cleaned.length < 2 || isBlacklistedKeyword(cleaned)) continue
    const relatedQueries = o.relatedQueries as Array<{ query?: string }> | undefined
    const analysis_keywords = Array.isArray(relatedQueries)
      ? relatedQueries.map((q) => String(q?.query ?? '').trim()).filter(Boolean).slice(0, 10)
      : []
    items.push({
      keyword: cleaned,
      rank: items.length + 1,
      search_volume: (o.formattedTraffic ?? o.approximateTraffic) != null ? String(o.formattedTraffic ?? o.approximateTraffic) : null,
      started_at: (o.time ?? o.publishedTime) != null ? String(o.time ?? o.publishedTime) : null,
      analysis_keywords,
    })
  }
  return items
}

/**
 * google-trends-api: realTimeTrends 우선 → 실패/빈 데이터 시 dailyTrends → 둘 다 실패 시 null (RSS 폴백).
 */
async function fetchTrendsFromApi(countryCode: string): Promise<TrendItem[] | null> {
  const geo = countryCode.toUpperCase()
  const hl = getHlForCountry(countryCode)

  try {
    const res = await Promise.race([
      googleTrends.realTimeTrends({ geo, hl, timezone: -540 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ])
    const data = parseGoogleTrendsResponse(res)
    if (data) {
      const items = mapRealTimeStoriesToItems(data)
      if (items.length >= 1) return items
    }
  } catch {
    /* fall through to dailyTrends */
  }

  try {
    const res = await Promise.race([
      googleTrends.dailyTrends({ geo, hl, timezone: -540 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
    ])
    const data = parseGoogleTrendsResponse(res)
    if (data) {
      const items = mapDailyTrendsToItems(data)
      if (items.length >= 1) return items
    }
  } catch {
    /* fall through to null → RSS */
  }

  return null
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
 * API(realTime → daily) 우선 수집, 둘 다 실패 시 RSS 폴백.
 * trend_status에 출처(API/RSS) 및 target_hours 기록.
 */
export async function refreshGlobalTrends(hours: number = DEFAULT_HOURS): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[] }> {
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  const supabase = getSupabase()

  console.log('[Trends] 수집 시작. API(realTime→daily) 우선, hours=', hours)
  for (const [countryCode] of Object.entries(COUNTRY_GEO)) {
    let items: TrendItem[]
    let sourceType: TrendSourceType

    try {
      const apiItems = await fetchTrendsFromApi(countryCode)
      if (apiItems && apiItems.length > 0) {
        items = apiItems
        sourceType = 'API'
        console.log('[Trends] API 수집 완료:', countryCode, '→', items.length, '개')
      } else {
        items = await fetchTrendsFromRss(countryCode)
        sourceType = 'RSS'
        console.log('[Trends] RSS 폴백 완료:', countryCode, '→', items.length, '개')
      }
    } catch (e) {
      try {
        items = await fetchTrendsFromRss(countryCode)
        sourceType = 'RSS'
        console.log('[Trends] API 실패 후 RSS 폴백:', countryCode, '→', items.length, '개')
      } catch {
        if (e instanceof TrendsFetchError) throw e
        throw new TrendsFetchError(
          e instanceof Error ? e.message : String(e),
          countryCode,
          getRssUrlsForCountry(countryCode)
        )
      }
    }

    results[countryCode] = items

    const rowsForRpc = items.map((t) => ({
      keyword: t.keyword,
      rank: t.rank,
      search_volume: t.search_volume,
      started_at: t.started_at,
      analysis_keywords: t.analysis_keywords,
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
    await upsertTrendStatus(supabase, countryCode, sourceType, hours)
    if (items.length > 0) console.log('Saved:', { country_code: countryCode, count: items.length, source_type: sourceType })
  }
  console.log('[Trends] 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length)
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
