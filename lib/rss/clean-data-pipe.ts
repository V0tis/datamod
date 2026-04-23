/**
 * signal_layer용 RSS·뉴스 기사 정제: 중복·광고성·유사 제목 제거 후 Top-K, PM 우선순위 스코어.
 * LLM 호출 전에만 사용 (`lib/research-news`·`runResearch`의 뉴스 항목과 동일 모양).
 */
export type CleanPipeArticle = {
  title: string
  url: string
  publisher?: string
  publishedAt?: string
}

/** LLM·후속 단계에 넘길 기본 상한 (권장 10~15) */
const DEFAULT_TOP_K = 15

/** `runResearch` `fetchNewsTitles`·공유 RSS에서 동일 수치로 사용 */
export const RSS_SIGNAL_LAYER_FETCH_CAP = 50
export const SIGNAL_LAYER_TOP_K = DEFAULT_TOP_K
const DEFAULT_SIMILARITY_THRESHOLD = 0.8
/** Jaccard(자소 bigram) 및 레벤슈타인 정규화 유사도 중 max가 이 이상이면 동일 군집 */
const SIMILARITY_THRESHOLD = DEFAULT_SIMILARITY_THRESHOLD

/** 광고/PR/비뉴스 느낌 키워드 (제목 부분일치) */
const PR_KEYWORD_PATTERNS: string[] = [
  '이벤트',
  '선착순',
  '증정',
  '출시기념',
  '공식대리점',
  '부고',
  '인사',
  '[광고]',
  '광고',
  'AD ',
  ' PR ',
  '프로모션',
  '할인행사',
]

export type CleanRemovalReason =
  | 'duplicate_url'
  | 'duplicate_title'
  | 'pr_keyword'
  | 'similarity_cluster'
  | 'top_k_cap'

export type CleanRemovalLog = {
  title: string
  url: string
  reason: CleanRemovalReason
  detail?: string
}

type IndexedArticle = { idx: number; item: CleanPipeArticle }

function normTitle(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFC')
    .toLowerCase()
}

function normUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  try {
    const u = new URL(t)
    u.hash = ''
    u.hostname = u.hostname.toLowerCase()
    ;['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'].forEach(
      (k) => u.searchParams.delete(k)
    )
    return u.toString()
  } catch {
    return t.toLowerCase()
  }
}

function hasPrKeyword(title: string): boolean {
  const lower = title.toLowerCase()
  for (const kw of PR_KEYWORD_PATTERNS) {
    const k = kw.trim()
    if (!k) continue
    if (title.includes(k) || (k.length >= 2 && lower.includes(k.toLowerCase()))) return true
  }
  return false
}

function charBigramSet(s: string): Set<string> {
  const t = s.replace(/\s/g, '')
  const out = new Set<string>()
  if (t.length < 2) {
    if (t.length === 1) out.add(t)
    return out
  }
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

function jaccardFromSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) {
    if (b.has(x)) inter++
  }
  const u = a.size + b.size - inter
  return u === 0 ? 0 : inter / u
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[] = new Array(n + 1)
  for (let j = 0; j <= n; j++) dp[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!
      dp[j] = Math.min(
        dp[j]! + 1,
        dp[j - 1]! + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      prev = tmp
    }
  }
  return dp[n]!
}

function levenshteinSimilarity(a: string, b: string): number {
  const t1 = a.trim()
  const t2 = b.trim()
  if (!t1 && !t2) return 1
  const d = levenshtein(t1, t2)
  const maxLen = Math.max(t1.length, t2.length, 1)
  return 1 - d / maxLen
}

function titleSimilarity(t1: string, t2: string): number {
  const a = charBigramSet(t1)
  const b = charBigramSet(t2)
  const j = jaccardFromSets(a, b)
  const l = levenshteinSimilarity(t1, t2)
  return Math.max(j, l)
}

/** 언론/도메인 가중 (0~100) — 뉴스·금융·해외 주요지 우선, 알 수 없으면 중간값 */
function publisherTrustScore(publisher: string | undefined): number {
  if (!publisher?.trim()) return 45
  const p = publisher.toLowerCase()
  if (
    /(chosun|joongang|donga|hani|kbs|mbc|sbs|ytn|yna|reuters|bloomberg|apnews|ap\.org|ft\.com|wsj|nikkei|bbc|cnn)/i.test(
      p
    )
  ) {
    return 92
  }
  if (/(hankyung|mt\.|mk\.|edaily|sedaily|fnnews|newsis|news1|zum|nate|daum|naver)/i.test(p)) {
    return 78
  }
  if (/(news\.google|google\.com|googlenews|feedproxy|alert)/i.test(p)) return 38
  return 52
}

/** PM·품질 스코어: 제목 길이 + 언론 가중 (동률·유사 군집 대표 선출·Top-K용) */
function pmQualityScore(article: CleanPipeArticle): number {
  const len = Math.min(article.title?.length ?? 0, 200)
  const lenPart = (len / 200) * 40
  const trust = publisherTrustScore(article.publisher)
  return lenPart + (trust / 100) * 60
}

class UnionFind {
  private parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(i: number): number {
    if (this.parent[i] !== i) this.parent[i] = this.find(this.parent[i]!)
    return this.parent[i]!
  }
  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[ra] = rb
  }
}

function logRemoval(
  logs: CleanRemovalLog[],
  item: CleanPipeArticle,
  reason: CleanRemovalReason,
  detail: string | undefined,
  quiet: boolean
) {
  logs.push({
    title: item.title,
    url: item.url,
    reason,
    detail,
  })
  if (quiet) return
  const msg = detail ? `${reason} | ${detail}` : reason
  console.log(`[CleanDataPipe] 제거 — Reason: ${msg} | ${item.title.slice(0, 100)}${item.title.length > 100 ? '…' : ''}`)
}

export type CleanDataPipeOptions = {
  /** LLM·후속 단계에 넘길 상한 (기본 12, 범위 권장 10~15) */
  topK?: number
  /** 제목 유사도 임계값 (0~1, 기본 0.8) */
  similarityThreshold?: number
  /** true면 제거 누적만, 콘솔 로그는 항상 남김 */
  quiet?: boolean
}

/**
 * `signal_layer`에서 모은 `CleanPipeArticle[]`에 대해
 * 1) URL·제목 exact 중복 제거
 * 2) PR/광고 키워드 제거
 * 3) 제목 유사(≥80%) 군집에서 스코어 최고 1건만
 * 4) Top-K 제한
 */
export function runCleanDataPipe(articles: CleanPipeArticle[], options: CleanDataPipeOptions = {}): {
  items: CleanPipeArticle[]
  removals: CleanRemovalLog[]
} {
  const topK = Math.min(50, Math.max(5, options.topK ?? DEFAULT_TOP_K))
  const simThreshold = options.similarityThreshold ?? SIMILARITY_THRESHOLD
  const quiet = options.quiet ?? false
  const removals: CleanRemovalLog[] = []

  if (articles.length === 0) {
    return { items: [], removals: [] }
  }

  // --- 1) Exact: URL, then title
  const seenUrl = new Set<string>()
  const seenTitle = new Set<string>()
  const afterExact: CleanPipeArticle[] = []
  for (const item of articles) {
    const u = normUrl(item.url)
    const t = normTitle(item.title)
    if (u) {
      if (seenUrl.has(u)) {
        logRemoval(removals, item, 'duplicate_url', 'Reason: duplicate URL (normalized)', quiet)
        continue
      }
      seenUrl.add(u)
    }
    if (t) {
      if (seenTitle.has(t)) {
        logRemoval(removals, item, 'duplicate_title', 'Reason: duplicate title (normalized)', quiet)
        continue
      }
      seenTitle.add(t)
    }
    afterExact.push({ ...item })
  }

  // --- 2) PR 키워드
  const afterPr: CleanPipeArticle[] = []
  for (const item of afterExact) {
    if (hasPrKeyword(item.title)) {
      const hit = PR_KEYWORD_PATTERNS.find((k) => k && item.title.includes(k)) ?? 'matched'
      logRemoval(removals, item, 'pr_keyword', `Reason: PR/광고 키워드 (${hit})`, quiet)
      continue
    }
    afterPr.push(item)
  }

  if (afterPr.length === 0) {
    return { items: [], removals }
  }

  // --- 3) Similarity — union same cluster if similarity >= threshold
  const n = afterPr.length
  const ufo = new UnionFind(n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = titleSimilarity(afterPr[i]!.title, afterPr[j]!.title)
      if (sim >= simThreshold) {
        ufo.union(i, j)
      }
    }
  }
  const groups = new Map<number, number[]>()
  for (let i = 0; i < n; i++) {
    const r = ufo.find(i)
    const arr = groups.get(r) ?? []
    arr.push(i)
    groups.set(r, arr)
  }

  const afterSim: CleanPipeArticle[] = []
  for (const [, idxs] of groups) {
    if (idxs.length === 1) {
      afterSim.push(afterPr[idxs[0]!]!)
      continue
    }
    const best = idxs
      .map((idx) => ({ idx, sc: pmQualityScore(afterPr[idx]!) }))
      .sort((a, b) => b.sc - a.sc || afterPr[a.idx]!.title.length - afterPr[b.idx]!.title.length)[0]!
    for (const idx of idxs) {
      if (idx === best.idx) continue
      logRemoval(
        removals,
        afterPr[idx]!,
        'similarity_cluster',
        `Reason: title similarity >= ${(simThreshold * 100).toFixed(0)}% (Jaccard bigram / Levenshtein, kept better score)`,
        quiet
      )
    }
    afterSim.push(afterPr[best.idx]!)
  }

  // --- 4) Top-K (긴 제목·높은 언론 점수 우선)
  const sorted = [...afterSim].sort((a, b) => pmQualityScore(b) - pmQualityScore(a))
  if (sorted.length <= topK) {
    return { items: sorted, removals }
  }
  const kept = sorted.slice(0, topK)
  for (const dropped of sorted.slice(topK)) {
    logRemoval(removals, dropped, 'top_k_cap', `Reason: top-${topK} after PM score sort`, quiet)
  }
  return { items: kept, removals }
}

export { DEFAULT_TOP_K, SIMILARITY_THRESHOLD, pmQualityScore, publisherTrustScore, titleSimilarity }
