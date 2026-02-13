'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Button } from '@/components/ui/button'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useResearchStore, type NewsItem } from '@/lib/stores/research-store'
import { printReportAsPdf } from '@/lib/pdf-export'
import { ResearchCharts } from '@/components/research-charts'
import { FileDown, Share2, X, ExternalLink, TrendingUp, BarChart3, Lightbulb, CheckSquare, Newspaper, Copy, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { Badge } from '@/components/ui/badge'
import { GroqAnalysis } from '@/components/research/GroqAnalysis'
import { GeminiAnalysis } from '@/components/research/GeminiAnalysis'
import { ConsensusInsight, type ConsensusData as ConsensusDataType } from '@/components/research/ConsensusInsight'

type AiTabId = 'logic' | 'creative' | 'fact'
const AI_TABS: { id: AiTabId; label: string; theme: string; icon: React.ElementType }[] = [
  { id: 'logic', label: '시장 분석', theme: 'data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800 border-blue-200', icon: BarChart3 },
  { id: 'creative', label: '인사이트', theme: 'data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 border-amber-200', icon: Lightbulb },
  { id: 'fact', label: '종합 리포트', theme: 'data-[state=active]:bg-emerald-100 data-[state=active]:text-emerald-800 border-emerald-200', icon: CheckSquare },
]

const QUOTA_TOAST_ID = 'quota-error'
const TAB_ERROR_TOAST_ID = 'tab-analysis-error'
const QUOTA_UNIFIED_MESSAGE = 'API 쿼터가 부족하여 분석을 중단했습니다. 설정에서 키를 확인해 주세요.'

type RssNewsItem = { title: string; link: string; pubDate: string; source: string }

function NewsDetailModal({
  item,
  preSummary,
  onClose,
}: {
  item: NewsItem
  preSummary?: string | null
  onClose: () => void
}) {
  const [showRawBody, setShowRawBody] = useState(false)
  const summary = preSummary ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-card shadow-lg flex flex-col">
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border dark:border-[#2d2f34] shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground dark:text-[#e1e3e6]">{item.title || '제목 없음'}</h3>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                원문 보기 <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* AI 요약: 통합 분석 결과에서만 표시 (summarize-article 호출 없음) */}
          <section>
            <h4 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-2">AI 요약</h4>
            {summary ? (
              <div className="text-sm text-foreground dark:text-slate-200 whitespace-pre-wrap leading-relaxed rounded-lg bg-primary/5 dark:bg-[#00d19a]/10 border border-primary/20 dark:border-[#00d19a]/30 p-4">
                {summary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground dark:text-slate-400">
                이 기사 요약은 이번 분석에 포함되지 않았어요. 원문에서 확인해 주세요.
              </p>
            )}
            {item.url && (
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" asChild>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  원문 링크 가기
                </a>
              </Button>
            )}
          </section>

          {/* 본문: 원문 링크 강조, 수집된 텍스트는 접기/펼치기 */}
          <section>
            <h4 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-2">본문</h4>
            <p className="text-sm text-muted-foreground dark:text-slate-400 mb-2">
              전체 내용은 원문에서 확인하세요.
            </p>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                원문 보기 <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {item.content && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowRawBody((v) => !v)}
                  className="text-xs text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-[#e1e3e6] underline"
                >
                  {showRawBody ? '수집된 텍스트 접기' : '수집된 텍스트 보기'}
                </button>
                {showRawBody && (
                  <div className="mt-2 text-xs text-muted-foreground dark:text-slate-400 whitespace-pre-wrap leading-relaxed rounded border border-border dark:border-[#2d2f34] bg-muted/30 dark:bg-card p-3 max-h-48 overflow-y-auto">
                    {item.content}
                  </div>
                )}
              </div>
            )}
            {!item.content && (
              <p className="text-sm text-muted-foreground dark:text-slate-400">수집된 본문이 없어요. 위 링크에서 확인해 주세요.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword')
  const {
    keyword: storeKeyword,
    status,
    newsList,
    result,
    error,
    startResearch,
    loadFromHistory,
  } = useResearchStore()

  const [activeTab, setActiveTab] = useState<AiTabId>('logic')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  /** 탭별 Groq / Gemini 2엔진 결과 */
  const [tabCacheGroq, setTabCacheGroq] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabCacheGemini, setTabCacheGemini] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabLoadingGroq, setTabLoadingGroq] = useState<Record<AiTabId, boolean>>({ logic: false, creative: false, fact: false })
  const [tabLoadingGemini, setTabLoadingGemini] = useState<Record<AiTabId, boolean>>({ logic: false, creative: false, fact: false })
  const [tabErrorGroq, setTabErrorGroq] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabErrorGemini, setTabErrorGemini] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [retryCountTabGroq, setRetryCountTabGroq] = useState<Record<AiTabId, number>>({ logic: 0, creative: 0, fact: 0 })
  const [retryCountTabGemini, setRetryCountTabGemini] = useState<Record<AiTabId, number>>({ logic: 0, creative: 0, fact: 0 })
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  /** Gemini 무료 쿼터 초과 시 세션 동안 더 이상 Gemini 요청 안 함 */
  const [geminiQuotaExceeded, setGeminiQuotaExceeded] = useState(false)
  const [followUps, setFollowUps] = useState<Array<{ question: string; answer: string }>>([])
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [selectedNewsIndex, setSelectedNewsIndex] = useState<number | null>(null)
  const [rssNews, setRssNews] = useState<RssNewsItem[]>([])
  const [rssNewsLoading, setRssNewsLoading] = useState(false)
  const [rssNewsFetched, setRssNewsFetched] = useState(false)
  /** 실시간 뉴스: 키워드가 바뀐 경우에만 재요청 (재분석 등으로 effect 재실행 시 중복 요청 방지) */
  const lastRssKeywordRef = useRef<string | null>(null)
  const [sharedTrends, setSharedTrends] = useState<TrendsResponse>({
    KR: [], US: [], JP: [], updatedAt: null,
  })
  const tabAbortControllerRef = useRef<AbortController | null>(null)
  /** 탭별 API 중복 호출 방지 (React Strict Mode 대응) */
  const tabHasFetchedRef = useRef<Record<AiTabId, boolean>>({ logic: false, creative: false, fact: false })
  const creativeFetchedForConsensusRef = useRef<string | null>(null)
  const isConsensusStartedRef = useRef(false)
  const retryConsensusInProgressRef = useRef(false)
  /** Consensus 재분석 중일 때는 DB analysis_results로 덮어쓰지 않음 */
  const isReanalyzingConsensusRef = useRef(false)

  /** AI Insight Consensus: PM 관점 JSON (summary, sentiment, strategic_insight, action_item, confidence) */
  const [consensusData, setConsensusData] = useState<ConsensusDataType | null>(null)
  /** Consensus만 재분석 중일 때 true (Groq/Gemini 카드는 로딩 안 함) */
  const [consensusReanalyzing, setConsensusReanalyzing] = useState(false)
  /** 히스토리 조회가 끝난 뒤에만 "린이 분석하는 중" 표시 (캐시 있으면 카드 먼저 보여주기) */
  const [historyCheckDone, setHistoryCheckDone] = useState(false)

  // URL keyword·country 기준: research_history 캐시 우선 → 없으면 stream 호출 (report·research_history 생성)
  const countryFromUrl = searchParams.get('country')?.trim() || 'KR'
  useEffect(() => {
    const k = (keyword ?? storeKeyword)?.trim()
    if (!k) return
    setHistoryCheckDone(false)
    let cancelled = false
    const countryCode = countryFromUrl
    loadFromHistory(k, countryCode)
      .then((historyStatus) => {
        if (cancelled) return
        if (historyStatus === 'cached') return
        if (historyStatus === 'empty' || historyStatus === 'none') {
          startResearch(k, { country_code: countryCode })
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryCheckDone(true)
      })
    return () => { cancelled = true }
  }, [keyword, storeKeyword, countryFromUrl, loadFromHistory, startResearch])

  useEffect(() => {
    fetch('/api/trends')
      .then((res) => parseJsonResponse<TrendsResponse & { refreshed?: boolean; refreshFailed?: boolean }>(res))
      .then((data) => {
        setSharedTrends({
          KR: normalizeTrendItems(data.KR),
          US: normalizeTrendItems(data.US),
          JP: normalizeTrendItems(data.JP),
          updatedAt: data.updatedAt ?? null,
        })
        if (data.refreshed) toast.success('데이터가 최신 상태로 업데이트되었습니다')
        if (data.refreshFailed) toast.warning('일시적 오류로 갱신에 실패했습니다. 기존 데이터를 표시합니다.')
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드를 불러오지 못했어요.' }))
  }, [])

  useEffect(() => {
    const q = (keyword ?? storeKeyword ?? '').trim()
    if (!q) {
      lastRssKeywordRef.current = null
      setRssNews([])
      setRssNewsFetched(false)
      return
    }
    if (lastRssKeywordRef.current === q) return
    lastRssKeywordRef.current = q
    setRssNewsLoading(true)
    setRssNewsFetched(false)
    fetch(`/api/news?keyword=${encodeURIComponent(q)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: RssNewsItem[] } | null) => {
        if (Array.isArray(data?.items)) setRssNews(data.items)
        else setRssNews([])
      })
      .catch(() => setRssNews([]))
      .finally(() => {
        setRssNewsLoading(false)
        setRssNewsFetched(true)
      })
  }, [keyword, storeKeyword])

  const loading = status === 'loading'
  /** 히스토리 확인 후, 스트림 분석 중일 때만 "린이 분석하는 중" 표시. result 있으면(캐시 포함) 탭·카드 표시 */
  const showAnalyzing = historyCheckDone && loading && !quotaExceeded && !error && !result
  const currentKeyword = keyword ?? storeKeyword

  const reportSummary = result
    ? [
        result.marketNews?.length ? `시장 뉴스 요약: ${result.marketNews.join(' ')}` : '',
        result.painPoints?.length ? `유저 페인포인트: ${result.painPoints.join(' ')}` : '',
        result.competitorTrends ? `경쟁사 동향: ${result.competitorTrends}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : ''
  const newsHeadlines = rssNews.length > 0 ? rssNews.map((i) => i.title).join('\n') : ''

  // DB 캐시(result.analysis_groq / analysis_gemini) → 탭 캐시 동기화. DB에 있으면 탭 API 호출 방지용 ref 세팅.
  useEffect(() => {
    if (!result?.reportId) return
    const groq = result.analysis_groq as Record<string, string> | undefined
    const gemini = result.analysis_gemini as Record<string, string> | undefined
    if (groq && typeof groq === 'object' && ('logic' in groq || 'creative' in groq || 'fact' in groq)) {
      setTabCacheGroq((prev) => ({
        ...prev,
        logic: typeof groq.logic === 'string' ? groq.logic : prev.logic,
        creative: typeof groq.creative === 'string' ? groq.creative : prev.creative,
        fact: typeof groq.fact === 'string' ? groq.fact : prev.fact,
      }))
    }
    if (gemini && typeof gemini === 'object' && ('logic' in gemini || 'creative' in gemini || 'fact' in gemini)) {
      setTabCacheGemini((prev) => ({
        ...prev,
        logic: typeof gemini.logic === 'string' ? gemini.logic : prev.logic,
        creative: typeof gemini.creative === 'string' ? gemini.creative : prev.creative,
        fact: typeof gemini.fact === 'string' ? gemini.fact : prev.fact,
      }))
    }
    // DB에 탭 데이터가 있으면 탭/consensus용 API 호출하지 않도록 표시
    const tabs: AiTabId[] = ['logic', 'creative', 'fact']
    tabs.forEach((t) => {
      const hasGroq = typeof groq?.[t] === 'string' && groq[t].trim().length > 0
      const hasGemini = typeof gemini?.[t] === 'string' && gemini[t].trim().length > 0
      if (hasGroq && hasGemini) tabHasFetchedRef.current[t] = true
    })
  }, [result?.reportId, result?.analysis_groq, result?.analysis_gemini])

  const prevReportIdRef = useRef<string | null>(null)
  useEffect(() => {
    const id = result?.reportId ?? null
    if (prevReportIdRef.current !== null && prevReportIdRef.current !== id) {
      setConsensusData(null)
      isConsensusStartedRef.current = false
      tabHasFetchedRef.current = { logic: false, creative: false, fact: false }
    }
    prevReportIdRef.current = id
  }, [result?.reportId])

  /** [우선순위 1] DB analysis_results 있으면 즉시 렌더링. 재분석 중이면 덮어쓰지 않음 */
  useEffect(() => {
    if (isReanalyzingConsensusRef.current) return
    const ar = result?.analysis_results as Record<string, unknown> | undefined
    if (!ar || typeof ar !== 'object') return
    const summary = typeof ar.summary === 'string' ? ar.summary.trim() : ''
    const sentiment = typeof ar.sentiment === 'number' ? Math.max(-100, Math.min(100, ar.sentiment)) : 0
    const strategic_insight = typeof ar.strategic_insight === 'string' ? ar.strategic_insight.trim() : '—'
    const action_item = typeof ar.action_item === 'string' ? ar.action_item.trim() : '—'
    const confidence = typeof ar.confidence === 'number' ? Math.max(0, Math.min(100, ar.confidence)) : 0
    if (summary !== '' || typeof ar.sentiment === 'number') {
      setConsensusData({ summary: summary || '—', sentiment, strategic_insight, action_item, confidence })
    }
  }, [result?.reportId, result?.analysis_results])

  const fetchTabAnalysis = useCallback(
    async (tabId: AiTabId, provider: 'groq' | 'gemini' | 'all' = 'all', options?: { isReanalyze?: boolean; reportId?: string; summary?: string }) => {
      if (quotaExceeded) return
      if (provider === 'gemini' && geminiQuotaExceeded) return
      if (provider === 'all' && geminiQuotaExceeded) return
      tabAbortControllerRef.current?.abort()
      const ac = new AbortController()
      tabAbortControllerRef.current = ac
      const doGroq = provider === 'groq' || provider === 'all'
      const doGemini = (provider === 'all' || provider === 'gemini') && !geminiQuotaExceeded
      const consensusOnlyReanalyze = (options?.isReanalyze === true && tabId === 'creative')
      if (!consensusOnlyReanalyze) {
        if (doGroq) setTabLoadingGroq((prev) => ({ ...prev, [tabId]: true }))
        if (doGemini) setTabLoadingGemini((prev) => ({ ...prev, [tabId]: true }))
      }
      setTabErrorGroq((prev) => ({ ...prev, [tabId]: null }))
      setTabErrorGemini((prev) => ({ ...prev, [tabId]: null }))
      const logicText = tabCacheGroq.logic ?? tabCacheGemini.logic ?? ''
      const creativeText = tabCacheGroq.creative ?? tabCacheGemini.creative ?? ''
      const isReanalyze = options?.isReanalyze ?? false
      const payload = {
        keyword: currentKeyword,
        summary: options?.summary ?? reportSummary,
        tab: tabId,
        reportId: options?.reportId ?? result?.reportId ?? undefined,
        newsHeadlines: newsHeadlines ?? undefined,
        provider,
        isReanalyze,
        countryCode: countryFromUrl,
        ...(tabId === 'fact' && { logicText, creativeText }),
      }
      if (isReanalyze && tabId === 'creative') {
        console.log('[AI Insight Consensus] POST /api/research/insights/tab 요청', { tab: tabId, provider, reportId: payload.reportId, summaryLength: typeof payload.summary === 'string' ? payload.summary.length : 0 })
      }
      try {
        const res = await fetch('/api/research/insights/tab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (isReanalyze && tabId === 'creative') {
          console.log('[AI Insight Consensus] POST /api/research/insights/tab 응답', { ok: res.ok, status: res.status, hasConsensus: !!(data as { consensus?: unknown }).consensus })
        }
        if (!res.ok) {
          const errMsg = (data as { error?: string }).error ?? '분석에 실패했습니다.'
          const isQuota = res.status === 429 || (data as { code?: string }).code === 'QUOTA'
          const errForModal = { ...(data as object), status: res.status, statusText: res.statusText }
          if (isQuota) {
            tabAbortControllerRef.current?.abort()
            setQuotaExceeded(true)
            setTabErrorGroq({ logic: QUOTA_UNIFIED_MESSAGE, creative: QUOTA_UNIFIED_MESSAGE, fact: QUOTA_UNIFIED_MESSAGE })
            setTabErrorGemini({ logic: QUOTA_UNIFIED_MESSAGE, creative: QUOTA_UNIFIED_MESSAGE, fact: QUOTA_UNIFIED_MESSAGE })
            setTabLoadingGroq({ logic: false, creative: false, fact: false })
            setTabLoadingGemini({ logic: false, creative: false, fact: false })
            toast.error('API 쿼터/요청 한도 초과', {
              id: QUOTA_TOAST_ID,
              description: '잠시 후 다시 시도해 주세요.',
              duration: 6000,
            })
          } else {
            if (provider === 'all' || provider === 'groq') {
              setRetryCountTabGroq((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
              setTabErrorGroq((prev) => ({ ...prev, [tabId]: errMsg }))
            }
            if (provider === 'all' || provider === 'gemini') {
              setRetryCountTabGemini((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
              setTabErrorGemini((prev) => ({ ...prev, [tabId]: errMsg }))
            }
            toast.error(errMsg, { id: TAB_ERROR_TOAST_ID, duration: 5000 })
            showErrorToast(errForModal, { fallbackMessage: errMsg })
          }
          return
        }
        const groqText = typeof (data as { groq?: { text?: string } }).groq?.text === 'string' ? (data as { groq: { text: string } }).groq.text : null
        const geminiText = typeof (data as { gemini?: { text?: string } }).gemini?.text === 'string' ? (data as { gemini: { text: string } }).gemini.text : null
        const groqErrorMsg = typeof (data as { groqError?: string }).groqError === 'string' ? (data as { groqError: string }).groqError : null
        const geminiQuotaExceeded = (data as { geminiQuotaExceeded?: boolean }).geminiQuotaExceeded === true
        if (groqText !== null) {
          setTabCacheGroq((prev) => ({ ...prev, [tabId]: groqText }))
          setRetryCountTabGroq((prev) => ({ ...prev, [tabId]: 0 }))
          setTabErrorGroq((prev) => ({ ...prev, [tabId]: null }))
        } else if (provider === 'all' || provider === 'groq') {
          setRetryCountTabGroq((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
          setTabErrorGroq((prev) => ({ ...prev, [tabId]: groqErrorMsg ?? '분석에 실패했습니다.' }))
        }
        if (geminiText !== null) {
          setTabCacheGemini((prev) => ({ ...prev, [tabId]: geminiText }))
          setRetryCountTabGemini((prev) => ({ ...prev, [tabId]: 0 }))
          setTabErrorGemini((prev) => ({ ...prev, [tabId]: null }))
        }
        const rawConsensus = (data as { consensus?: ConsensusDataType }).consensus
        if (rawConsensus && typeof rawConsensus === 'object' && typeof rawConsensus.summary === 'string' && typeof rawConsensus.sentiment === 'number') {
          setConsensusData({
            summary: String(rawConsensus.summary).slice(0, 200),
            sentiment: Math.max(-100, Math.min(100, Number(rawConsensus.sentiment))),
            strategic_insight: typeof rawConsensus.strategic_insight === 'string' ? rawConsensus.strategic_insight.slice(0, 300) : '—',
            action_item: typeof rawConsensus.action_item === 'string' ? rawConsensus.action_item.slice(0, 300) : '—',
            confidence: typeof rawConsensus.confidence === 'number' ? Math.max(0, Math.min(100, rawConsensus.confidence)) : 0,
          })
        }
        if (geminiText === null && (provider === 'all' || provider === 'gemini')) {
          if (geminiQuotaExceeded) {
            setGeminiQuotaExceeded(true)
            setTabErrorGemini((prev) => ({ ...prev, [tabId]: '무료 쿼터 초과' }))
          } else {
            setRetryCountTabGemini((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
            setTabErrorGemini((prev) => ({ ...prev, [tabId]: '분석에 실패했습니다.' }))
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const fallback = '분석을 불러오지 못했어요. 다시 시도해 주세요.'
        if (provider === 'all' || provider === 'groq') {
          setRetryCountTabGroq((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
          setTabErrorGroq((prev) => ({ ...prev, [tabId]: fallback }))
        }
        if (provider === 'all' || provider === 'gemini') {
          setRetryCountTabGemini((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
          setTabErrorGemini((prev) => ({ ...prev, [tabId]: fallback }))
        }
        toast.error(fallback, { id: TAB_ERROR_TOAST_ID, duration: 5000 })
        showErrorToast(err, { fallbackMessage: fallback })
      } finally {
        setTabLoadingGroq((prev) => ({ ...prev, [tabId]: false }))
        setTabLoadingGemini((prev) => ({ ...prev, [tabId]: false }))
      }
    },
    [currentKeyword, countryFromUrl, reportSummary, result?.reportId, tabCacheGroq, tabCacheGemini, newsHeadlines, quotaExceeded, geminiQuotaExceeded]
  )

  // 탭 분석: DB(result.analysis_groq/analysis_gemini)에 이미 있으면 API 호출 절대 안 함. 재시도 버튼으로만 호출.
  useEffect(() => {
    if (quotaExceeded) return
    const t = activeTab as AiTabId
    if (t !== 'logic' && t !== 'creative' && t !== 'fact') return
    if (status === 'loading') return
    if (status !== 'done' && status !== 'error') return

    const groq = result?.analysis_groq as Record<string, string> | undefined
    const gemini = result?.analysis_gemini as Record<string, string> | undefined
    const hasDbCache = (tabId: AiTabId) => {
      const g = groq && typeof groq[tabId] === 'string' && groq[tabId].trim().length > 0
      const m = gemini && typeof gemini[tabId] === 'string' && gemini[tabId].trim().length > 0
      return g && m
    }
    if (result?.reportId && hasDbCache('logic') && hasDbCache('creative') && hasDbCache('fact')) {
      tabHasFetchedRef.current = { logic: true, creative: true, fact: true }
      return
    }
    if (tabHasFetchedRef.current[t]) return
    if (tabLoadingGroq[t] || tabLoadingGemini[t]) return
    if (tabErrorGroq[t] || tabErrorGemini[t]) return

    const groqFromResult = !!(groq && typeof groq[t] === 'string' && groq[t].trim().length > 0)
    const geminiFromResult = !!(gemini && typeof gemini[t] === 'string' && gemini[t].trim().length > 0)
    const needGroq = !tabCacheGroq[t] && !groqFromResult
    const needGemini = !geminiQuotaExceeded && !tabCacheGemini[t] && !geminiFromResult
    if (!needGroq && !needGemini) return
    tabHasFetchedRef.current[t] = true
    if (needGroq && needGemini) {
      fetchTabAnalysis(t, 'all')
    } else if (needGroq) {
      fetchTabAnalysis(t, 'groq')
    } else if (needGemini) {
      fetchTabAnalysis(t, 'gemini')
    }
  }, [activeTab, status, result?.reportId, result?.analysis_groq, result?.analysis_gemini, tabCacheGroq, tabCacheGemini, tabLoadingGroq, tabLoadingGemini, tabErrorGroq, tabErrorGemini, fetchTabAnalysis, quotaExceeded, geminiQuotaExceeded])

  /** [1. 실행 조건] 각 AI 상태: idle | loading | success | error. 두 상태가 모두 loading·idle이 아닐 때만 consensus 실행 */
  type CreativeAiState = 'idle' | 'loading' | 'success' | 'error'
  const creativeGroqState: CreativeAiState = tabLoadingGroq.creative
    ? 'loading'
    : tabCacheGroq.creative != null
      ? 'success'
      : tabErrorGroq.creative != null
        ? 'error'
        : 'idle'
  const creativeGeminiState: CreativeAiState = tabLoadingGemini.creative
    ? 'loading'
    : tabCacheGemini.creative != null
      ? 'success'
      : tabErrorGemini.creative != null
        ? 'error'
        : 'idle'
  const bothSettledForConsensus =
    creativeGroqState !== 'idle' &&
    creativeGroqState !== 'loading' &&
    creativeGeminiState !== 'idle' &&
    creativeGeminiState !== 'loading'

  useEffect(() => {
    if (status !== 'done' || !result?.reportId || quotaExceeded || geminiQuotaExceeded) return
    const hasDbConsensus = result.analysis_results != null && typeof result.analysis_results === 'object' && (typeof (result.analysis_results as Record<string, unknown>).summary === 'string' || typeof (result.analysis_results as Record<string, unknown>).sentiment === 'number')
    if (hasDbConsensus) {
      isConsensusStartedRef.current = true
      return
    }
    if (consensusData != null) return
    if (isConsensusStartedRef.current) return
    const groqFromResult = typeof (result.analysis_groq as Record<string, string> | undefined)?.creative === 'string' && (result.analysis_groq as Record<string, string>).creative.trim().length > 0
    const geminiFromResult = typeof (result.analysis_gemini as Record<string, string> | undefined)?.creative === 'string' && (result.analysis_gemini as Record<string, string>).creative.trim().length > 0
    const needGroq = !tabCacheGroq.creative && !groqFromResult
    const needGemini = !tabCacheGemini.creative && !geminiFromResult
    const haveBoth = (tabCacheGroq.creative != null || groqFromResult) && (tabCacheGemini.creative != null || geminiFromResult)
    if (needGroq || needGemini) {
      if (creativeFetchedForConsensusRef.current === result.reportId) return
      creativeFetchedForConsensusRef.current = result.reportId
      isConsensusStartedRef.current = true
      fetchTabAnalysis('creative', 'all')
      return
    }
    if (!haveBoth || !bothSettledForConsensus) return
    const groqOk = (tabCacheGroq.creative ?? (groqFromResult ? (result.analysis_groq as Record<string, string>).creative : '') ?? '').trim().length > 0
    const geminiOk = (tabCacheGemini.creative ?? (geminiFromResult ? (result.analysis_gemini as Record<string, string>).creative : '') ?? '').trim().length > 0
    if (!groqOk && !geminiOk) return
    if (groqFromResult && geminiFromResult) return
    isConsensusStartedRef.current = true
    creativeFetchedForConsensusRef.current = result.reportId
    fetchTabAnalysis('creative', 'all')
  }, [status, result?.reportId, result?.analysis_groq, result?.analysis_gemini, quotaExceeded, geminiQuotaExceeded, consensusData, bothSettledForConsensus, tabCacheGroq.creative, tabCacheGemini.creative, fetchTabAnalysis])

  /** AI Insight Consensus 전용 재시도: 한 번만 API 호출. Consensus API(tab creative)만 호출. */
  const retryConsensus = useCallback(async () => {
    if (retryConsensusInProgressRef.current) return
    const k = currentKeyword?.trim()
    if (!k) return
    console.log('[AI Insight Consensus] 재분석 시작', { keyword: k, country: countryFromUrl })
    retryConsensusInProgressRef.current = true
    isReanalyzingConsensusRef.current = true
    setConsensusReanalyzing(true)
    const clearProgress = () => {
      retryConsensusInProgressRef.current = false
      isReanalyzingConsensusRef.current = false
      setConsensusReanalyzing(false)
    }
    try {
      if (result?.reportId) {
        console.log('[AI Insight Consensus] 현재 result.reportId로 Consensus만 재분석', { reportId: result.reportId })
        setConsensusData(null)
        setTabErrorGroq((prev) => ({ ...prev, creative: null }))
        setTabErrorGemini((prev) => ({ ...prev, creative: null }))
        creativeFetchedForConsensusRef.current = null
        isConsensusStartedRef.current = false
        await fetchTabAnalysis('creative', 'all', { isReanalyze: true })
        console.log('[AI Insight Consensus] API 호출 완료 (reportId 경로)')
        return
      }
      console.log('[AI Insight Consensus] reportId 없음, 히스토리에서 캐시 조회')
      const historyStatus = await loadFromHistory(k, countryFromUrl)
      if (historyStatus === 'cached') {
        const cachedResult = useResearchStore.getState().result
        if (cachedResult?.reportId) {
          const cachedSummary = [
            cachedResult.marketNews?.length ? `시장 뉴스 요약: ${cachedResult.marketNews.join(' ')}` : '',
            cachedResult.painPoints?.length ? `유저 페인포인트: ${cachedResult.painPoints.join(' ')}` : '',
            cachedResult.competitorTrends ? `경쟁사 동향: ${cachedResult.competitorTrends}` : '',
          ].filter(Boolean).join('\n\n')
          console.log('[AI Insight Consensus] 캐시된 reportId로 Consensus만 재분석', { reportId: cachedResult.reportId, summaryLength: cachedSummary.length })
          setConsensusData(null)
          setTabErrorGroq((prev) => ({ ...prev, creative: null }))
          setTabErrorGemini((prev) => ({ ...prev, creative: null }))
          creativeFetchedForConsensusRef.current = null
          isConsensusStartedRef.current = false
          await fetchTabAnalysis('creative', 'all', { isReanalyze: true, reportId: cachedResult.reportId, summary: cachedSummary })
          console.log('[AI Insight Consensus] API 호출 완료 (캐시 경로)')
          return
        }
      }
      toast.info('저장된 분석 결과가 없어 Consensus만 재분석할 수 없어요. 키워드로 먼저 검색해 주세요.')
    } finally {
      clearProgress()
    }
  }, [currentKeyword, countryFromUrl, result?.reportId, loadFromHistory, fetchTabAnalysis])

  const handleShare = useCallback(async () => {
    const reportId = result?.reportId
    if (!reportId) return
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('공유 링크가 복사되었어요.')
      return
    }
    try {
      const res = await fetch(`/api/reports/${reportId}/share`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(data, { fallbackMessage: '공유 링크를 만들 수 없어요.' })
        return
      }
      const url = (data as { url?: string }).url
      if (url) {
        const absoluteUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`
        setShareUrl(absoluteUrl)
        await navigator.clipboard.writeText(absoluteUrl)
        toast.success('공유 링크가 생성되었고 클립보드에 복사되었어요.')
      }
    } catch (err) {
      showErrorToast(err, { fallbackMessage: '공유 링크 생성에 실패했어요.' })
    }
  }, [result?.reportId, shareUrl])

  const handleFollowUp = useCallback(async () => {
    const q = followUpQuestion.trim()
    if (!q || followUpLoading) return
    const previousInsights = result?.publicReactionTrends ?? tabCacheGroq.creative ?? tabCacheGemini.creative ?? ''
    if (!previousInsights) return
    setFollowUpLoading(true)
    setFollowUpQuestion('')
    try {
      const res = await fetch('/api/research/insights/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: currentKeyword,
          previousInsights,
          question: q,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(data, { fallbackMessage: '답변을 불러오지 못했어요.' })
        setFollowUpLoading(false)
        return
      }
      const answer = (data as { answer?: string }).answer ?? '답변을 생성하지 못했어요.'
      setFollowUps((prev) => [...prev, { question: q, answer }])
    } catch (err) {
      showErrorToast(err, { fallbackMessage: '추가 질문 처리에 실패했어요.' })
    } finally {
      setFollowUpLoading(false)
    }
  }, [followUpQuestion, followUpLoading, currentKeyword, result?.publicReactionTrends, tabCacheGroq.creative, tabCacheGemini.creative])

  const showTabs = !!currentKeyword
  if (showTabs) {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-[#F9FAFB] dark:bg-[#0f1113] rin-doc">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main: col-span-8 - 탭/뉴스 영역 배경 dark:bg-card */}
          <div className="lg:col-span-8 space-y-6 dark:bg-card rounded-xl p-1">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card shadow-sm p-6 md:p-8 transition-colors duration-200 dark:hover:bg-[#1c1e21]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground dark:text-[#e1e3e6] ">
            &quot;{currentKeyword}&quot; 검색 결과
          </h1>
          <p className="text-muted-foreground dark:text-slate-400 text-sm mt-1">
            {showAnalyzing
              ? '린이 가져온 뉴스예요. 다른 페이지로 이동해도 분석은 계속돼요.'
              : '탭을 전환해 시장 분석, 인사이트, 종합 리포트를 확인하세요.'}
          </p>
        </header>

        {/* 최상단: AI Insight Consensus. DB analysis_results 우선 렌더링, 두 AI settled 후에만 API 호출 */}
        {!result ? (
          <div className="no-print w-full mb-6 rounded-xl border border-zinc-800 bg-[#15171a] p-5">
            <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">AI Insight Consensus</h2>
            {status === 'error' && error ? (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
                <p className="text-sm text-rose-400">{error}</p>
                {error.includes('형식이 올바르지 않아요') && (
                  <p className="text-xs text-slate-500">(초기 분석 단계에서 JSON 파싱 실패. 서버 로그에 rawJson 스니펫이 기록됩니다.)</p>
                )}
                <Button variant="outline" size="sm" className="border-zinc-600 text-slate-300 hover:bg-zinc-700/50" onClick={retryConsensus}>
                  다시 분석하기
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                분석이 완료되면 Groq·Gemini 2사 종합 요약, 감성 점수, 핵심 전략·실행 권고가 여기 표시됩니다.
              </p>
            )}
          </div>
        ) : (
          <ConsensusInsight
            data={consensusData}
            loading={((tabLoadingGroq.creative || tabLoadingGemini.creative) || consensusReanalyzing) && !consensusData}
            bothFailed={bothSettledForConsensus && creativeGroqState === 'error' && creativeGeminiState === 'error'}
            errorMessage={result?.analysis_results ? null : (tabErrorGroq.creative || tabErrorGemini.creative || null)}
            onRetry={retryConsensus}
          />
        )}

        {status === 'done' && result && (
          <div className="no-print flex flex-wrap items-center gap-2 mb-4">
            <Button type="button" variant="outline" size="sm" onClick={printReportAsPdf} className="gap-1.5">
              <FileDown className="w-4 h-4" />
              PDF로 저장
            </Button>
            {result.reportId && (
              <Button type="button" variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
                <Share2 className="w-4 h-4" />
                {shareUrl ? '링크 복사' : '공유하기'}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const parts = [
                  result.marketNews?.length ? `시장 뉴스\n${result.marketNews.join('\n')}` : '',
                  result.painPoints?.length ? `유저 페인포인트\n${result.painPoints.join('\n')}` : '',
                  result.competitorTrends ? `경쟁사 동향\n${result.competitorTrends}` : '',
                  result.publicReactionTrends ? `공개 반응 트렌드\n${result.publicReactionTrends}` : '',
                  (result.key_metrics?.keyConclusions ?? result.keyConclusions)?.length ? `핵심 결론\n${(result.key_metrics?.keyConclusions ?? result.keyConclusions)!.join('\n')}` : '',
                ].filter(Boolean)
                const text = parts.join('\n\n')
                if (!text) return
                navigator.clipboard.writeText(text).then(() => toast.success('텍스트가 복사되었어요.'))
              }}
            >
              <Copy className="w-4 h-4" />
              텍스트 복사
            </Button>
          </div>
        )}

        {/* 재분석 버튼: 완료 시 표시, 로딩 시에도 스피너와 메시지 유지 */}
        {(status === 'done' && result) || (status === 'loading' && currentKeyword) ? (
          <div className="no-print w-full flex flex-wrap items-center gap-3 mb-4 pb-2 border-b border-border dark:border-[#2d2f34]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={loading}
              onClick={() => startResearch(currentKeyword ?? '', { country_code: countryFromUrl })}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI가 최신 정보를 분석 중입니다...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  새로운 데이터로 다시 분석하기
                </>
              )}
            </Button>
            {status === 'done' && result?.reportId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 dark:border-[#00d19a] dark:text-[#00d19a] dark:hover:bg-[#00d19a]/10"
                disabled={
                  tabLoadingGroq[activeTab] || tabLoadingGemini[activeTab]
                }
                onClick={() => {
                  setTabCacheGroq((prev) => ({ ...prev, [activeTab]: null }))
                  setTabCacheGemini((prev) => ({ ...prev, [activeTab]: null }))
                  setTabErrorGroq((prev) => ({ ...prev, [activeTab]: null }))
                  setTabErrorGemini((prev) => ({ ...prev, [activeTab]: null }))
                  fetchTabAnalysis(activeTab as AiTabId, 'all', { isReanalyze: true })
                }}
              >
                {tabLoadingGroq[activeTab] || tabLoadingGemini[activeTab] ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    탭 분석 재실행 중...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    재분석 (캐시 무시)
                  </>
                )}
              </Button>
            )}
            {result?.updated_at && !loading && (
              <span className="text-xs text-muted-foreground dark:text-slate-400">
                마지막 업데이트: <TimeAgo isoString={result.updated_at} />
              </span>
            )}
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AiTabId)} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-3 h-12 p-1 gap-1 bg-muted/60 dark:bg-[#1a1c20] dark:border dark:border-[#33363b]">
            {AI_TABS.map(({ id, label, theme, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className={cn('gap-2 border border-transparent dark:data-[state=active]:bg-[#202226] dark:data-[state=active]:text-[#00d19a] dark:data-[state=active]:border-b-2 dark:data-[state=active]:border-[#00d19a] dark:data-[state=active]:rounded-b-none', theme)}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 실시간 뉴스: 탭 리스트 바로 아래, 분석 콘텐츠 위 */}
          {currentKeyword && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-foreground dark:text-[#e1e3e6] mb-4 flex items-center gap-2 tracking-tight">
                <Newspaper className="h-4 w-4 text-primary" />
                실시간 뉴스
                {rssNewsLoading && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-normal text-muted-foreground dark:text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    불러오는 중
                  </span>
                )}
              </h2>
              {rssNewsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-card p-4 animate-pulse"
                    >
                      <div className="h-4 w-full bg-muted dark:bg-zinc-700/50 rounded mb-3" />
                      <div className="h-4 w-3/4 bg-muted dark:bg-zinc-700/50 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-muted dark:bg-zinc-700/50 rounded" />
                    </div>
                  ))}
                </div>
              ) : rssNewsFetched && rssNews.length === 0 ? (
                <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-card p-6 text-center">
                  <p className="text-muted-foreground dark:text-slate-400 text-sm">
                    &quot;{currentKeyword}&quot;에 대한 실시간 뉴스 정보가 없습니다.
                  </p>
                  <p className="text-muted-foreground dark:text-slate-500 text-xs mt-1">
                    다른 키워드로 검색해 보시거나, 잠시 후 다시 시도해 주세요.
                  </p>
                </div>
              ) : rssNews.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rssNews.map((item, i) => (
                    <article
                      key={i}
                      className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-card overflow-hidden hover:shadow-md hover:border-primary/20 dark:hover:bg-[#1c1e21] transition-all text-left flex flex-col"
                    >
                      <div className="p-4 flex flex-col gap-3 flex-1 min-w-0">
                        <h3 className="font-medium text-foreground dark:text-[#e1e3e6] text-[15px] leading-snug line-clamp-2">
                          {item.title || '제목 없음'}
                        </h3>
                        <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-slate-400">
                          <span>{item.source || '언론사'}</span>
                          <span>{item.pubDate ? <TimeAgo isoString={item.pubDate} /> : '최신'}</span>
                        </div>
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-auto"
                          >
                            원문 링크
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {quotaExceeded ? (
            <div className="mt-6 flex flex-col items-center justify-center min-h-[320px] text-center rounded-xl border border-border dark:bg-[#0f1113] dark:border-[#00d19a] bg-card dark:border-[#00d19a] p-8">
              <p className="text-destructive font-medium dark:text-[#00d19a]">{QUOTA_UNIFIED_MESSAGE}</p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/settings">설정에서 키 확인</Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuotaExceeded(false)
                    setTabErrorGroq({ logic: null, creative: null, fact: null })
                    setTabErrorGemini({ logic: null, creative: null, fact: null })
                    setTabCacheGroq((prev) => ({ ...prev, [activeTab]: null }))
                    setTabCacheGemini((prev) => ({ ...prev, [activeTab]: null }))
                    fetchTabAnalysis(activeTab as AiTabId, 'all')
                  }}
                >
                  다시 시도
                </Button>
              </div>
            </div>
          ) : (
          AI_TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-6">
              {!historyCheckDone && !result ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <RinAnimation variant="loading" size={100} className="shrink-0" />
                  <p className="mt-3 text-muted-foreground dark:text-slate-400 text-sm">이전 결과 불러오는 중...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <GroqAnalysis
                      tabId={id}
                      text={tabCacheGroq[id] ?? (result?.analysis_groq as Record<string, string>)?.[id] ?? null}
                      loading={!(result?.analysis_groq as Record<string, string>)?.[id] && (tabLoadingGroq[id] || (loading && !result))}
                      error={tabErrorGroq[id]}
                      retryCount={retryCountTabGroq[id] ?? 0}
                      onRetry={() => {
                        if ((retryCountTabGroq[id] ?? 0) >= 3) {
                          setRetryCountTabGroq((prev) => ({ ...prev, [id]: 0 }))
                          setTabErrorGroq((prev) => ({ ...prev, [id]: null }))
                        }
                        setTabCacheGroq((prev) => ({ ...prev, [id]: null }))
                        fetchTabAnalysis(id, 'groq')
                      }}
                    />
                    <GeminiAnalysis
                      tabId={id}
                      text={tabCacheGemini[id] ?? (result?.analysis_gemini as Record<string, string>)?.[id] ?? null}
                      loading={!(result?.analysis_gemini as Record<string, string>)?.[id] && (tabLoadingGemini[id] || (loading && !result))}
                      error={tabErrorGemini[id]}
                      retryCount={retryCountTabGemini[id] ?? 0}
                      quotaExceeded={geminiQuotaExceeded}
                      onRetry={() => {
                        if (tabErrorGemini[id] === '무료 쿼터 초과') {
                          setTabErrorGemini((prev) => ({ ...prev, [id]: null }))
                          return
                        }
                        if ((retryCountTabGemini[id] ?? 0) >= 3) {
                          setRetryCountTabGemini((prev) => ({ ...prev, [id]: 0 }))
                          setTabErrorGemini((prev) => ({ ...prev, [id]: null }))
                        }
                        setTabCacheGemini((prev) => ({ ...prev, [id]: null }))
                        fetchTabAnalysis(id, 'gemini')
                      }}
                    />
                  </div>
                  {id === 'creative' && (
                    <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-card p-6 mt-6">
                      <p className="text-sm font-medium text-foreground dark:text-[#e1e3e6] mb-3">더 궁금한 점이 있나요?</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="궁금한 점을 입력하세요"
                          value={followUpQuestion}
                          onChange={(e) => setFollowUpQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                          className="flex-1 rounded-lg border border-input dark:border-[#33363b] bg-background dark:bg-[#1a1c20] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring dark:text-[#e1e3e6] placeholder:dark:text-slate-500"
                          disabled={followUpLoading}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleFollowUp}
                          disabled={followUpLoading || !followUpQuestion.trim()}
                        >
                          {followUpLoading ? '답변 중...' : '질문하기'}
                        </Button>
                      </div>
                      {followUps.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {followUps.map((item, i) => (
                            <div key={i} className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                              <p className="text-sm text-muted-foreground dark:text-slate-400 font-medium">Q. {item.question}</p>
                              <p className="text-foreground dark:text-[#e1e3e6] whitespace-pre-wrap text-sm">{item.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )))}
        </Tabs>

        {/* Section 3. 핵심 요약: 결론 3가지 Badge (key_metrics.keyConclusions 우선) */}
        {status === 'done' && result && (result.key_metrics?.keyConclusions?.length ?? result.keyConclusions?.length ?? 0) > 0 && (
          <div className="mt-8 pt-6 border-t border-border dark:border-[#2d2f34]">
            <h2 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">핵심 요약</h2>
            <div className="flex flex-wrap gap-2">
              {(result.key_metrics?.keyConclusions ?? result.keyConclusions ?? []).slice(0, 3).map((line, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal py-2 px-3 max-w-full sm:max-w-md text-left whitespace-normal">
                  {line}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {selectedNews && (
          <NewsDetailModal
            item={selectedNews}
            preSummary={
              selectedNewsIndex != null && result?.articleSummaries?.[selectedNewsIndex]
                ? result.articleSummaries[selectedNewsIndex]
                : null
            }
            onClose={() => {
              setSelectedNews(null)
              setSelectedNewsIndex(null)
            }}
          />
        )}
        </div>
          </div>

          {/* Side widgets: col-span-4 - 검색량·감성 추이 + 실시간 트렌드 */}
          <div className="lg:col-span-4 space-y-4 bg-[#F9FAFB] dark:bg-transparent rounded-xl p-1">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card shadow-sm p-4 dark:hover:bg-[#1c1e21] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">24시간 검색량·감성 추이</h3>
              {(() => {
                const chartDataForUi = result?.key_metrics?.chartData ?? result?.chartData
                return chartDataForUi ? (
                  <ResearchCharts chartData={chartDataForUi} />
                ) : (
                  <p className="text-muted-foreground dark:text-slate-400 text-xs py-4">데이터가 없어요. 분석 완료 후 표시돼요.</p>
                )
              })()}
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card shadow-sm p-4 dark:hover:bg-[#1c1e21] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                실시간 트렌드
              </h3>
              {(sharedTrends.KR.length + sharedTrends.US.length + sharedTrends.JP.length) > 0 ? (
                <>
                  <ul className="space-y-3 mb-3">
                    {([...sharedTrends.KR, ...sharedTrends.US, ...sharedTrends.JP] as TrendItem[]).slice(0, 6).map((item, i) => (
                      <li key={`${item.keyword}-${i}`}>
                        <div className="rounded-lg border border-border dark:border-[#2d2f34] bg-[#F9FAFB] dark:bg-card p-3 hover:bg-muted/50 dark:hover:bg-[#1c1e21] transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/results?keyword=${encodeURIComponent(item.keyword)}`}
                              className="text-sm font-medium text-foreground dark:text-[#e1e3e6] truncate hover:text-primary dark:hover:text-[#00d19a]"
                            >
                              {item.keyword}
                            </Link>
                            {item.search_volume != null && (
                              <span className="text-xs shrink-0 tabular-nums text-muted-foreground dark:text-slate-400">
                                {item.search_volume}
                              </span>
                            )}
                          </div>
                          {item.started_at && (
                            <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">{item.started_at}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground dark:text-slate-400">최근 업데이트: <TimeAgo isoString={sharedTrends.updatedAt} /></p>
                  <Link href="/trends" className="text-xs text-primary hover:underline mt-1 inline-block">전체 보기</Link>
                </>
              ) : (
                <p className="text-muted-foreground dark:text-slate-400 text-xs">트렌드 데이터를 불러오는 중이에요.</p>
              )}
            </div>
            {/* 핵심 수치 요약 */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card shadow-sm p-4 dark:hover:bg-[#1c1e21] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">핵심 수치 요약</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground dark:text-slate-400">감성 지수</dt>
                  <dd className="font-semibold text-foreground dark:text-[#00d19a]">{result ? (result.key_metrics?.sentiment ?? result.sentiment ?? 0) : '—'}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground dark:text-slate-400">시장 뉴스</dt>
                  <dd className="font-semibold text-foreground dark:text-[#00d19a]">{result ? (result.marketNews?.length ?? 0) : '—'}건</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground dark:text-slate-400">페인포인트</dt>
                  <dd className="font-semibold text-foreground dark:text-[#00d19a]">{result ? (result.painPoints?.length ?? 0) : '—'}건</dd>
                </div>
              </dl>
            </div>
            {/* 인용된 출처 리스트 */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card shadow-sm p-4 dark:hover:bg-[#1c1e21] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">인용된 출처</h3>
              {newsList.length === 0 ? (
                <p className="text-muted-foreground dark:text-slate-400 text-xs">출처가 없어요.</p>
              ) : (
                <ul className="space-y-1.5">
                  {newsList.map((item, i) => (
                    <li key={i}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate block"
                      >
                        {item.title || item.url || `출처 ${i + 1}`}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!keyword) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-6 bg-[#F9FAFB] dark:bg-[#0f1113]">
        <div className="rounded-2xl border border-border dark:border-[#2d2f34] bg-white dark:bg-card shadow-sm p-8 text-center max-w-md">
          <p className="text-muted-foreground dark:text-slate-400 mb-4">검색어가 없습니다.</p>
          <Link href="/">
            <Button variant="outline">검색으로 돌아가기</Button>
          </Link>
        </div>
      </div>
    )
  }

  return null
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-6 bg-[#F9FAFB] dark:bg-[#0f1113]">
          <div className="rounded-2xl border border-border dark:border-[#2d2f34] bg-white dark:bg-card shadow-sm p-8">
            <RinAnimation variant="loading" size={200} />
            <p className="text-muted-foreground dark:text-slate-400 mt-4">{getRandomRinMessage()}</p>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  )
}
