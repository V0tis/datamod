'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useResearchStore, type NewsItem, type ResearchResponse } from '@/lib/stores/research-store'
import { type AnalysisMode, type StreamingState, createIdleState } from '@/lib/types/analysis-modes'
import { useCurrentTask } from '@/lib/hooks/use-current-task'
import { printReportAsPdf } from '@/lib/pdf-export'
import { FileDown, X, ExternalLink, BarChart3, Lightbulb, CheckSquare, Newspaper, Loader2, RefreshCw, ChevronDown, ChevronUp, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { GroqAnalysis } from '@/components/research/GroqAnalysis'
import { GeminiAnalysis } from '@/components/research/GeminiAnalysis'
import { ConsensusInsight, type ConsensusData, normalizeConsensusData } from '@/components/research/ConsensusInsight'
import { MarketTemperature } from '@/components/research/market-temperature'
import { SuggestedPMActions } from '@/components/research/suggested-pm-actions'
import { AnalysisQualityIndicator } from '@/components/research/analysis-quality-indicator'
import { InsightSummary } from '@/components/research/InsightSummary'
import { computeAnalysisQualityScore } from '@/lib/analysis-quality-score'
import { KeyFindings } from '@/components/research/KeyFindings'
import { ResultsReportView } from '@/components/research/ResultsReportView'
import type { TabAnalysisRecord } from '@/lib/research-types'
import type { InsightSnapshot, InsightQualityScore } from '@/lib/insights-types'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-lg flex flex-col">
        <div className="flex items-start justify-between gap-3 p-3 sm:p-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground">{item.title || '제목 없음'}</h3>
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
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
          {/* AI 요약: 통합 분석 결과에서만 표시 (summarize-article 호출 없음) */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-2">전략적 통찰</h4>
            {summary ? (
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed rounded-lg bg-primary/5 border border-primary/20 p-4">
                {summary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-muted-foreground">
                이 기사 요약은 이번 분석에 포함되지 않았습니다. 원문에서 확인해 주세요.
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
            <h4 className="text-sm font-semibold text-foreground mb-2">본문</h4>
            <p className="text-sm text-muted-foreground text-muted-foreground mb-2">
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
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {showRawBody ? '수집된 텍스트 접기' : '수집된 텍스트 보기'}
                </button>
                {showRawBody && (
                  <div className="mt-2 text-xs text-muted-foreground text-muted-foreground whitespace-pre-wrap leading-relaxed rounded border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                    {item.content}
                  </div>
                )}
              </div>
            )}
            {!item.content && (
              <p className="text-sm text-muted-foreground text-muted-foreground">수집된 본문이 없습니다. 위 링크에서 확인해 주세요.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * Results view is driven by global analysis state (store).
 * URL ?keyword= and ?country= select the task; store holds status, result, error.
 * useCurrentTask syncs selection and provides task-level progress for the analyzing state.
 */
function ResultsContent() {
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword')
  const countryFromUrl = searchParams.get('country')?.trim() || 'KR'
  const currentTask = useCurrentTask(keyword, countryFromUrl)
  const {
    keyword: storeKeyword,
    status,
    analysisStatus,
    analysisMode,
    streamingState,
    newsList,
    result,
    error,
    startStreamingResearch,
    abortAnalysis,
    loadFromHistory,
    mergeResultAnalysis,
  } = useResearchStore()

  const [activeTab, setActiveTab] = useState<AiTabId>('logic')
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
  /** 실시간 뉴스 기간(일). 기본 30일 */
  const [newsDays, setNewsDays] = useState(30)
  /** 실시간 뉴스: 키워드·기간이 바뀐 경우에만 재요청 */
  const lastRssFetchKeyRef = useRef<string | null>(null)
  const [sharedTrends, setSharedTrends] = useState<TrendsResponse>({
    KR: [], US: [], JP: [], TW: [], HK: [], GB: [], DE: [], updatedAt: null,
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
  const [consensusData, setConsensusData] = useState<ConsensusData | null>(null)
  /** Consensus만 재분석 중일 때 true (Groq/Gemini 카드는 로딩 안 함) */
  const [consensusReanalyzing, setConsensusReanalyzing] = useState(false)
  /** Mobile: collapse secondary sidebar (momentum, trends, metrics, sources) to reduce scroll; expand for comprehension. */
  const [sidebarOpen, setSidebarOpen] = useState(false)
  /** Mobile: Evidence (뉴스·상세 분석) collapsed by default so Summary + Key findings + Insight stay above the fold. */
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  /** Mobile: Implication (Next steps) collapsed by default; secondary to main insight. */
  const [implicationOpen, setImplicationOpen] = useState(false)
  /** Save as Insight modal */
  const [saveInsightOpen, setSaveInsightOpen] = useState(false)
  const [saveInsightName, setSaveInsightName] = useState('')
  const [saveInsightNote, setSaveInsightNote] = useState('')
  const [saveInsightSaving, setSaveInsightSaving] = useState(false)

  const currentKeyword = keyword ?? storeKeyword
  const urlKeyword = keyword?.trim() ?? null
  const storeKeywordTrim = (storeKeyword ?? '').trim()
  /** URL 키워드와 스토어 활성 작업이 같을 때만 result/status/error 표시 → 다른 분석 데이터 깜빡임 방지 */
  const isViewingActiveJob = urlKeyword === null || storeKeywordTrim === urlKeyword
  const displayResult = isViewingActiveJob ? result : null
  const displayStatus = isViewingActiveJob ? status : (urlKeyword ? 'loading' : status)
  const displayError = isViewingActiveJob ? error : null
  const canonicalStatus = isViewingActiveJob ? analysisStatus : (urlKeyword ? ('analyzing' as const) : analysisStatus)

  // Default Evidence and Implication expanded on desktop so content is visible without tapping; collapsed on mobile for scannability.
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
    if (!mq) return
    const setOpen = () => {
      setEvidenceOpen(mq.matches)
      setImplicationOpen(mq.matches)
    }
    setOpen()
    mq.addEventListener('change', setOpen)
    return () => mq.removeEventListener('change', setOpen)
  }, [])

  // URL keyword·country: load from history or start streaming analysis.
  useEffect(() => {
    const k = (keyword ?? storeKeyword)?.trim()
    if (!k) return
    let cancelled = false
    const countryCode = countryFromUrl
    loadFromHistory(k, countryCode)
      .then((historyStatus) => {
        if (cancelled) return
        if (historyStatus === 'cached') return
        if (historyStatus === 'error') return
        if (historyStatus === 'empty' || historyStatus === 'none') {
          const state = useResearchStore.getState()
          if (state.result?.reportId && state.keyword === k) return
          if (state.analysisStatus === 'analyzing' && state.keyword === k) return
          startStreamingResearch(k, { country_code: countryCode })
        }
      })
      .finally(() => { /* sync handled by store */ })
    return () => { cancelled = true }
  }, [keyword, storeKeyword, countryFromUrl, loadFromHistory, startStreamingResearch])

  useEffect(() => {
    fetch('/api/trends')
      .then((res) => parseJsonResponse<TrendsResponse & { refreshed?: boolean; refreshFailed?: boolean }>(res))
      .then((data) => {
        setSharedTrends({
          KR: normalizeTrendItems(data.KR),
          US: normalizeTrendItems(data.US),
          JP: normalizeTrendItems(data.JP),
          TW: normalizeTrendItems(data.TW),
          HK: normalizeTrendItems(data.HK),
          GB: normalizeTrendItems(data.GB),
          DE: normalizeTrendItems(data.DE),
          updatedAt: data.updatedAt ?? null,
        })
        if (data.refreshed) toast.success('데이터가 최신 상태로 업데이트되었습니다')
        if (data.refreshFailed) toast.warning('일시적 오류로 갱신에 실패했습니다. 기존 데이터를 표시합니다.')
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드를 불러오지 못했습니다.' }))
  }, [])

  useEffect(() => {
    const q = (keyword ?? storeKeyword ?? '').trim()
    const days = Math.min(365, Math.max(1, newsDays))
    if (!q) {
      lastRssFetchKeyRef.current = null
      setRssNews([])
      setRssNewsFetched(false)
      return
    }
    const fetchKey = `${q}|${days}`
    if (lastRssFetchKeyRef.current === fetchKey) return
    lastRssFetchKeyRef.current = fetchKey
    setRssNewsLoading(true)
    setRssNewsFetched(false)
    fetch(`/api/news?keyword=${encodeURIComponent(q)}&days=${days}`)
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
  }, [keyword, storeKeyword, newsDays])

  const loading = canonicalStatus === 'queued' || canonicalStatus === 'analyzing'
  const hasKeyword = Boolean((currentKeyword ?? '').trim())
  /** 한국이 아닌 국가일 때 헤더에 표시할 번역: 현재 키워드와 같은 트렌드 항목의 title_ko */
  const headerTitleKo =
    countryFromUrl !== 'KR' && (currentKeyword ?? '').trim()
      ? (() => {
          const list: TrendItem[] =
            countryFromUrl === 'US' ? sharedTrends.US
            : countryFromUrl === 'JP' ? sharedTrends.JP
            : countryFromUrl === 'TW' ? sharedTrends.TW
            : countryFromUrl === 'HK' ? sharedTrends.HK
            : countryFromUrl === 'GB' ? sharedTrends.GB
            : countryFromUrl === 'DE' ? sharedTrends.DE
            : []
          const found = list.find((t: TrendItem) => t.keyword === (currentKeyword ?? '').trim())
          return found?.title_ko != null && found.title_ko !== found.keyword ? found.title_ko : null
        })()
      : null

  const reportSummary = displayResult
    ? [
        displayResult.marketNews?.length ? `시장 뉴스 요약: ${displayResult.marketNews.join(' ')}` : '',
        displayResult.painPoints?.length ? `유저 페인포인트: ${displayResult.painPoints.join(' ')}` : '',
        displayResult.competitorTrends ? `경쟁사 동향: ${displayResult.competitorTrends}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    : ''
  const newsHeadlines = rssNews.length > 0 ? rssNews.map((i) => i.title).join('\n') : ''

  // DB 캐시(result.analysis_groq / analysis_gemini) → 탭 캐시 동기화. DB에 있으면 탭 API 호출 방지용 ref 세팅. 현재 URL 키워드와 일치할 때만 적용.
  useEffect(() => {
    if (!isViewingActiveJob || !displayResult?.reportId) return
    const groq = displayResult.analysis_groq as TabAnalysisRecord | undefined
    const gemini = displayResult.analysis_gemini as TabAnalysisRecord | undefined
    if (groq && typeof groq === 'object' && ('creative' in groq || 'fact' in groq)) {
      setTabCacheGroq((prev) => ({
        ...prev,
        creative: typeof groq.creative === 'string' ? groq.creative : prev.creative,
        fact: typeof groq.fact === 'string' ? groq.fact : prev.fact,
      }))
    }
    if (gemini && typeof gemini === 'object' && ('creative' in gemini || 'fact' in gemini)) {
      setTabCacheGemini((prev) => ({
        ...prev,
        creative: typeof gemini.creative === 'string' ? gemini.creative : prev.creative,
        fact: typeof gemini.fact === 'string' ? gemini.fact : prev.fact,
      }))
    }
    const tabs: AiTabId[] = ['logic', 'creative', 'fact']
    tabs.forEach((t) => {
      const key = t === 'logic' ? 'creative' : t
      const hasGroq = typeof groq?.[key] === 'string' && groq[key].trim().length > 0
      const hasGemini = typeof gemini?.[key] === 'string' && gemini[key].trim().length > 0
      if (hasGroq && hasGemini) tabHasFetchedRef.current[t] = true
    })
  }, [isViewingActiveJob, displayResult?.reportId, displayResult?.analysis_groq, displayResult?.analysis_gemini])

  const prevReportIdRef = useRef<string | null>(null)
  useEffect(() => {
    const id = displayResult?.reportId ?? null
    if (prevReportIdRef.current !== null && prevReportIdRef.current !== id) {
      setConsensusData(null)
      isConsensusStartedRef.current = false
      tabHasFetchedRef.current = { logic: false, creative: false, fact: false }
    }
    prevReportIdRef.current = id
  }, [displayResult?.reportId])

  /** [우선순위 1] DB analysis_results 있으면 즉시 렌더링. 재분석 중이면 덮어쓰지 않음 */
  useEffect(() => {
    if (!isViewingActiveJob || isReanalyzingConsensusRef.current) return
    const ar = displayResult?.analysis_results
    if (!ar || typeof ar !== 'object') return
    const normalized = normalizeConsensusData(ar)
    if (normalized) setConsensusData(normalized)
  }, [isViewingActiveJob, displayResult?.reportId, displayResult?.analysis_results])

  const fetchTabAnalysis = useCallback(
    async (tabId: AiTabId, provider: 'groq' | 'gemini' | 'all' = 'all', options?: { isReanalyze?: boolean; reportId?: string; summary?: string }) => {
      if (quotaExceeded) {
        toast.error('API 쿼터가 부족합니다. 설정에서 키를 확인하거나 잠시 후 다시 시도해 주세요.')
        return
      }
      const isReanalyze = options?.isReanalyze === true
      if (provider === 'gemini' && geminiQuotaExceeded && !isReanalyze) return
      if (provider === 'all' && geminiQuotaExceeded && !isReanalyze) return
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
      const logicText = tabCacheGroq.creative ?? tabCacheGemini.creative ?? ''
      const creativeText = tabCacheGroq.creative ?? tabCacheGemini.creative ?? ''
      const payload = {
        keyword: currentKeyword,
        summary: options?.summary ?? reportSummary,
        tab: tabId,
        reportId: options?.reportId ?? displayResult?.reportId ?? undefined,
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
              setTabLoadingGroq((prev) => ({ ...prev, [tabId]: false }))
            }
            if (provider === 'all' || provider === 'gemini') {
              setRetryCountTabGemini((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
              setTabErrorGemini((prev) => ({ ...prev, [tabId]: errMsg }))
              setTabLoadingGemini((prev) => ({ ...prev, [tabId]: false }))
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
        const geminiErrorMsg = typeof (data as { geminiError?: string }).geminiError === 'string' ? (data as { geminiError: string }).geminiError : null
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
        const rawConsensus = (data as { consensus?: unknown }).consensus
        const normalized = rawConsensus && typeof rawConsensus === 'object' ? normalizeConsensusData(rawConsensus) : null
        if (normalized) setConsensusData(normalized)
        if (groqText !== null || geminiText !== null) {
          mergeResultAnalysis(tabId, groqText, geminiText)
        }
        if (geminiText === null && (provider === 'all' || provider === 'gemini')) {
          if (geminiQuotaExceeded) {
            setGeminiQuotaExceeded(true)
            setTabErrorGemini((prev) => ({ ...prev, [tabId]: geminiErrorMsg ?? '무료 쿼터 초과' }))
          } else {
            setRetryCountTabGemini((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
            setTabErrorGemini((prev) => ({ ...prev, [tabId]: geminiErrorMsg ?? '분석에 실패했습니다.' }))
          }
          setTabLoadingGemini((prev) => ({ ...prev, [tabId]: false }))
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const fallback = '분석을 불러오지 못했습니다. 다시 시도해 주세요.'
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
    [currentKeyword, countryFromUrl, reportSummary, displayResult?.reportId, tabCacheGroq, tabCacheGemini, newsHeadlines, quotaExceeded, geminiQuotaExceeded, mergeResultAnalysis]
  )

  // 탭 분석: DB(result.analysis_groq/analysis_gemini)에 이미 있으면 API 호출 절대 안 함. 재시도 버튼으로만 호출.
  useEffect(() => {
    if (quotaExceeded) return
    const t = activeTab as AiTabId
    if (t !== 'logic' && t !== 'creative' && t !== 'fact') return
    if (displayStatus === 'loading') return
    if (displayStatus !== 'done' && displayStatus !== 'error') return

    const groq = displayResult?.analysis_groq as TabAnalysisRecord | undefined
    const gemini = displayResult?.analysis_gemini as TabAnalysisRecord | undefined
    const hasDbCache = (tabId: AiTabId) => {
      const key = tabId === 'logic' ? 'creative' : tabId
      const g = groq && typeof groq[key] === 'string' && groq[key].trim().length > 0
      const m = gemini && typeof gemini[key] === 'string' && gemini[key].trim().length > 0
      return !!g && !!m
    }
    if (displayResult?.reportId && hasDbCache('logic') && hasDbCache('creative') && hasDbCache('fact')) {
      tabHasFetchedRef.current = { logic: true, creative: true, fact: true }
      return
    }
    if (t === 'logic') {
      tabHasFetchedRef.current.logic = true
      return
    }
    if (tabHasFetchedRef.current[t]) return
    if (tabLoadingGroq[t] || tabLoadingGemini[t]) return
    if (tabErrorGroq[t] || tabErrorGemini[t]) return

    const contentKey = t as keyof TabAnalysisRecord
    const groqFromResult = !!(groq && typeof groq[contentKey] === 'string' && groq[contentKey].trim().length > 0)
    const geminiFromResult = !!(gemini && typeof gemini[contentKey] === 'string' && gemini[contentKey].trim().length > 0)
    const needGroq = !tabCacheGroq[t] && !groqFromResult
    const needGemini = !geminiQuotaExceeded && !tabCacheGemini[t] && !geminiFromResult
    if (!needGroq && !needGemini) return
    tabHasFetchedRef.current[t] = true
    if (needGroq && needGemini) {
      setTabLoadingGroq((prev) => ({ ...prev, [t]: true }))
      setTabLoadingGemini((prev) => ({ ...prev, [t]: true }))
      fetchTabAnalysis(t, 'all')
    } else if (needGroq) {
      setTabLoadingGroq((prev) => ({ ...prev, [t]: true }))
      fetchTabAnalysis(t, 'groq')
    } else if (needGemini) {
      setTabLoadingGemini((prev) => ({ ...prev, [t]: true }))
      fetchTabAnalysis(t, 'gemini')
    }
  }, [activeTab, displayStatus, displayResult?.reportId, displayResult?.analysis_groq, displayResult?.analysis_gemini, tabCacheGroq, tabCacheGemini, tabLoadingGroq, tabLoadingGemini, tabErrorGroq, tabErrorGemini, fetchTabAnalysis, quotaExceeded, geminiQuotaExceeded])

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
    if (displayStatus !== 'done' || !displayResult?.reportId || quotaExceeded || geminiQuotaExceeded) return
    // DB may store consensus in analysis_results.consensus (new) or analysis_results.summary/sentiment (legacy).
    const hasDbConsensus = displayResult?.analysis_results != null && typeof displayResult.analysis_results === 'object' && (typeof (displayResult.analysis_results as Record<string, unknown>).summary === 'string' || typeof (displayResult.analysis_results as Record<string, unknown>).sentiment === 'number')
    if (hasDbConsensus) {
      isConsensusStartedRef.current = true
      return
    }
    if (consensusData != null) return
    if (isConsensusStartedRef.current) return
    const groqCreative = (displayResult?.analysis_groq as TabAnalysisRecord | undefined)?.creative
    const geminiCreative = (displayResult?.analysis_gemini as TabAnalysisRecord | undefined)?.creative
    const groqFromResult = typeof groqCreative === 'string' && groqCreative.trim().length > 0
    const geminiFromResult = typeof geminiCreative === 'string' && geminiCreative.trim().length > 0
    const needGroq = !tabCacheGroq.creative && !groqFromResult
    const needGemini = !tabCacheGemini.creative && !geminiFromResult
    const haveBoth = (tabCacheGroq.creative != null || groqFromResult) && (tabCacheGemini.creative != null || geminiFromResult)
    if (needGroq || needGemini) {
      if (creativeFetchedForConsensusRef.current === displayResult.reportId) return
      creativeFetchedForConsensusRef.current = displayResult.reportId
      isConsensusStartedRef.current = true
      fetchTabAnalysis('creative', 'all')
      return
    }
    if (!haveBoth || !bothSettledForConsensus) return
    const groqOk = (tabCacheGroq.creative ?? (groqFromResult ? groqCreative : '') ?? '').trim().length > 0
    const geminiOk = (tabCacheGemini.creative ?? (geminiFromResult ? geminiCreative : '') ?? '').trim().length > 0
    if (!groqOk && !geminiOk) return
    if (groqFromResult && geminiFromResult) return
    isConsensusStartedRef.current = true
    creativeFetchedForConsensusRef.current = displayResult?.reportId ?? null
    fetchTabAnalysis('creative', 'all')
  }, [displayStatus, displayResult?.reportId, displayResult?.analysis_groq, displayResult?.analysis_gemini, quotaExceeded, geminiQuotaExceeded, consensusData, bothSettledForConsensus, tabCacheGroq.creative, tabCacheGemini.creative, fetchTabAnalysis])

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
      if (displayResult?.reportId) {
        console.log('[AI Insight Consensus] 현재 result.reportId로 Consensus만 재분석', { reportId: displayResult?.reportId })
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
      toast.info('저장된 분석이 없어 재분석할 수 없습니다. 키워드로 먼저 검색해 주세요.')
    } finally {
      clearProgress()
    }
  }, [currentKeyword, countryFromUrl, displayResult?.reportId, loadFromHistory, fetchTabAnalysis])

  const handleFollowUp = useCallback(async () => {
    const q = followUpQuestion.trim()
    if (!q || followUpLoading) return
    const previousInsights = displayResult?.publicReactionTrends ?? tabCacheGroq.creative ?? tabCacheGemini.creative ?? ''
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
        showErrorToast(data, { fallbackMessage: '답변을 불러오지 못했습니다.' })
        setFollowUpLoading(false)
        return
      }
      const answer = (data as { answer?: string }).answer ?? '답변을 생성하지 못했습니다.'
      setFollowUps((prev) => [...prev, { question: q, answer }])
    } catch (err) {
      showErrorToast(err, { fallbackMessage: '추가 질문 처리에 실패했습니다.' })
    } finally {
      setFollowUpLoading(false)
    }
  }, [followUpQuestion, followUpLoading, currentKeyword, displayResult?.publicReactionTrends, tabCacheGroq.creative, tabCacheGemini.creative])

  const buildInsightSnapshot = useCallback((): InsightSnapshot => {
    const summary =
      consensusData?.strategicSummary?.summary?.trim() ||
      (displayResult?.key_metrics?.keyConclusions ?? displayResult?.keyConclusions)?.[0] ||
      ''
    const qualityInput = {
      marketNews: displayResult?.marketNews ?? consensusData?.marketNews,
      painPoints: displayResult?.painPoints ?? consensusData?.painPoints,
      competitorTrends: displayResult?.competitorTrends ?? consensusData?.competitorTrends,
      sentiment: consensusData?.sentiment ?? (displayResult?.key_metrics?.sentiment != null ? { score: (displayResult.key_metrics.sentiment - 50) * 2 } : undefined),
      impactAnalysis: consensusData?.impactAnalysis ?? displayResult?.key_metrics?.chartData?.impact,
      strategicSummary: consensusData?.strategicSummary,
      metadata: consensusData?.metadata,
    }
    const q = computeAnalysisQualityScore(qualityInput)
    const qualityScore: InsightQualityScore = { score: q.score, label: q.label, explanation: q.explanation }
    return {
      keyword: currentKeyword ?? '',
      countryCode: countryFromUrl,
      summary: summary || undefined,
      strategicSummary: consensusData?.strategicSummary
        ? {
            summary: consensusData.strategicSummary.summary || undefined,
            actionItems: consensusData.strategicSummary.actionItems,
            opportunity: consensusData.strategicSummary.opportunity,
            threat: consensusData.strategicSummary.threat,
          }
        : undefined,
      reportId: displayResult?.reportId ?? null,
      savedAt: new Date().toISOString(),
      qualityScore,
    }
  }, [consensusData, displayResult, currentKeyword, countryFromUrl])

  const handleSaveInsightOpen = useCallback(() => {
    setSaveInsightName((currentKeyword ?? '').trim() || '인사이트')
    setSaveInsightNote('')
    setSaveInsightOpen(true)
  }, [currentKeyword])

  const handleSaveInsightSubmit = useCallback(async () => {
    const name = saveInsightName.trim()
    if (!name || saveInsightSaving) return
    setSaveInsightSaving(true)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, note: saveInsightNote.trim() || undefined, snapshot: buildInsightSnapshot() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(data, { fallbackMessage: (data as { error?: string }).error ?? '저장에 실패했습니다.' })
        return
      }
      toast.success('인사이트로 저장했습니다.')
      setSaveInsightOpen(false)
    } catch (err) {
      showErrorToast(err, { fallbackMessage: '저장에 실패했습니다.' })
    } finally {
      setSaveInsightSaving(false)
    }
  }, [saveInsightName, saveInsightNote, saveInsightSaving, buildInsightSnapshot])

  const showTabs = hasKeyword
  if (showTabs) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6 md:p-8 min-h-screen bg-background rin-doc">
        {/* Reading mode: grid gap and main column spacing use CSS variables from data-reading-mode */}
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 reading-gap-lg">
          <div className="lg:col-span-8 reading-space-y-lg bg-card rounded-xl p-0 sm:p-1 min-w-0">
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 sm:p-6 md:p-8 transition-colors duration-200 hover:bg-muted rin-reading reading-space-y-lg reading-text">
        {/* Single primary context header. No stacked labels. */}
        <header className="pb-4 border-b border-border/60">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight break-words">
            &quot;{currentKeyword}&quot;
            {headerTitleKo && (
              <span className="ml-2 text-base font-normal text-muted-foreground" title="한국어 번역">
                · {headerTitleKo}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            {canonicalStatus === 'queued' || canonicalStatus === 'analyzing'
              ? (currentTask?.progress ?? '분석 중')
              : canonicalStatus === 'completed' && displayResult?.updated_at
                ? <>마지막 업데이트: <TimeAgo isoString={displayResult.updated_at} /></>
                : canonicalStatus === 'failed'
                  ? '분석 실패'
                  : null}
          </p>
        </header>

        {/* Full layout always renders. Failed shows ErrorState; otherwise ResultsReportView with section-level loading. */}
        {canonicalStatus === 'failed' ? (
          <div className="py-6">
            <ErrorState
              title="분석을 완료하지 못했습니다"
              description="서버가 바쁘거나 일시적인 오류일 수 있습니다."
              recoveryLabel="다시 분석하기"
              onRecovery={() => startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })}
              detail={displayError ?? undefined}
            />
          </div>
        ) : (
          <ResultsReportView
            keyword={currentKeyword ?? ''}
            result={displayResult}
            analysisStatus={canonicalStatus}
            onPrint={printReportAsPdf}
            onSaveInsight={handleSaveInsightOpen}
            onReanalyze={() => startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })}
            onAbort={abortAnalysis}
            reanalyzing={loading}
            progress={currentTask?.progress ?? null}
            analysisMode={analysisMode}
            streamingState={streamingState}
          />
        )}

        {/* Legacy blocks hidden: ResultsReportView provides summary + actions when completed. */}
        {false && (
          <section id="insight-summary" className="scroll-mt-4 rounded-lg border border-border/60 bg-background/50 p-4 sm:p-5 reading-section-gap" aria-label="Insight summary">
            <h2 className="text-sm font-medium text-foreground mb-3">요약</h2>
            <div className="reading-space-y">
              <InsightSummary
                summary={
                  consensusData?.strategicSummary?.summary?.trim() ||
                  (displayResult?.key_metrics?.keyConclusions ?? displayResult?.keyConclusions)?.[0] ||
                  ''
                }
                sentimentScore={consensusData?.sentiment?.score ?? null}
                trend={consensusData?.sentiment?.trend ?? 'stable'}
                confidence={consensusData?.metadata?.confidence ?? null}
                partialData={bothSettledForConsensus && (creativeGroqState === 'success') !== (creativeGeminiState === 'success')}
                loading={
                  ((tabLoadingGroq.creative || tabLoadingGemini.creative) || consensusReanalyzing) &&
                  !consensusData &&
                  !(displayResult?.key_metrics?.keyConclusions ?? displayResult?.keyConclusions)?.[0]
                }
              />
              {(() => {
                const km = displayResult?.key_metrics
                const keyFindingItems =
                  (km?.facts?.length ?? 0) > 0 || (km?.inferences?.length ?? 0) > 0
                    ? [...(km?.facts ?? []), ...(km?.inferences ?? [])].slice(0, 5)
                    : (km?.keyConclusions?.length ?? displayResult?.keyConclusions?.length ?? 0) > 0
                      ? (km?.keyConclusions ?? displayResult?.keyConclusions ?? []).slice(0, 5)
                      : (consensusData?.strategicSummary?.actionItems ?? []).slice(0, 5)
                if (keyFindingItems.length === 0) return null
                return <KeyFindings items={keyFindingItems} title="핵심 정리" maxItems={5} />
              })()}
            </div>
          </section>
        )}

        {/* Suggested PM Actions: hidden when using ResultsReportView. */}
        {false && displayStatus === 'done' && displayResult && (
          <SuggestedPMActions
            marketTempScore={
              ((): number | null => {
                const s = consensusData?.sentiment?.score
                if (typeof s === 'number') return s as number
                return (displayResult?.key_metrics?.sentiment != null || displayResult?.sentiment != null)
                  ? (Number(displayResult?.key_metrics?.sentiment ?? displayResult?.sentiment ?? 50) - 50) * 2
                  : null
              })()
            }
            competitionScore={
              consensusData?.impactAnalysis?.find((i) => i.subject === '경쟁력')?.score ??
              displayResult?.key_metrics?.chartData?.impact?.find((i) => i.subject === '경쟁력')?.score ??
              null
            }
            signalConfidence={consensusData?.metadata?.confidence ?? null}
            onSaveAsInsight={(actions) => {
              setSaveInsightNote(actions.join('\n\n'))
              setSaveInsightName((currentKeyword ?? '').trim() || 'PM 액션 제안')
              setSaveInsightOpen(true)
            }}
          />
        )}

        {/* Actions: hidden when using ResultsReportView. */}
        {false && displayStatus === 'done' && displayResult && (
          <div className="no-print flex flex-wrap items-center gap-2 sm:gap-3 mb-6 pb-4 border-b border-border">
            <Button type="button" variant="outline" size="sm" onClick={printReportAsPdf} className="gap-1.5">
              <FileDown className="w-4 h-4" />
              PDF로 저장
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleSaveInsightOpen} className="gap-1.5 border-primary/50 text-primary hover:bg-primary/10">
              <Bookmark className="w-4 h-4" />
              인사이트로 저장
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled={loading}
              onClick={() => startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })}
              aria-label="전체 리포트를 새 데이터로 다시 생성"
              aria-busy={loading}
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
            {displayResult?.reportId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-primary text-primary hover:bg-primary/10"
                disabled={tabLoadingGroq[activeTab] || tabLoadingGemini[activeTab]}
                aria-label="현재 탭만 캐시 무시하고 다시 분석"
                aria-busy={tabLoadingGroq[activeTab] || tabLoadingGemini[activeTab]}
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
          </div>
        )}

        {/* Evidence & raw analysis: collapsible. Shown when completed. */}
        <section className="reading-section-gap" aria-labelledby="consensus-heading">
          <h2 id="consensus-heading" className="text-sm font-medium text-foreground mb-3">
            상세 분석
          </h2>
        {canonicalStatus === 'failed' ? (
          <div className="no-print w-full rounded-xl border border-border bg-card p-6">
            <ErrorState
              title="분석을 완료하지 못했습니다"
              description="서버가 바쁘거나 일시적인 오류일 수 있습니다. 아래 버튼으로 다시 시도해 주세요."
              recoveryLabel="다시 분석하기"
              onRecovery={() => startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })}
              detail={displayError?.includes('형식이 올바르지 않아요') ? 'AI 응답 형식이 올바르지 않아 파싱에 실패했습니다. 재시도하면 해결되는 경우가 많습니다.' : displayError ?? undefined}
            />
          </div>
        ) : canonicalStatus === 'queued' || canonicalStatus === 'analyzing' ? (
          <div className="no-print w-full rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 py-4">
              <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {currentTask?.progress ?? '분석 중'}
              </p>
            </div>
          </div>
        ) : canonicalStatus === 'completed' && displayResult ? (
          <ConsensusInsight
            data={consensusData}
            loading={((tabLoadingGroq.creative || tabLoadingGemini.creative) || consensusReanalyzing) && !consensusData}
            bothFailed={bothSettledForConsensus && creativeGroqState === 'error' && creativeGeminiState === 'error'}
            partialData={bothSettledForConsensus && (creativeGroqState === 'success') !== (creativeGeminiState === 'success')}
            errorMessage={displayResult?.analysis_results ? null : (tabErrorGroq.creative || tabErrorGemini.creative || null)}
            onRetry={retryConsensus}
          />
        ) : (
          <div className="no-print w-full rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3 py-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/80">
                <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">
                분석을 실행하면 전략 통찰이 여기에 표시됩니다.
              </p>
            </div>
          </div>
        )}
        </section>

        {/* Evidence: news, market analysis, reports. Collapsed by default for document flow. */}
        <section className="reading-section-gap rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5" aria-label="Evidence">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-medium text-foreground">뉴스 · 시장 분석 · 종합 리포트</h3>
            <button
              type="button"
              onClick={() => setEvidenceOpen((o) => !o)}
              className="flex items-center gap-1.5 min-h-[44px] py-2 px-2 -my-1 text-xs font-medium text-muted-foreground hover:text-foreground touch-manipulation rounded"
              aria-expanded={evidenceOpen}
              aria-controls="evidence-content"
            >
              {evidenceOpen ? '접기' : '펼치기'}
              {evidenceOpen ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
            </button>
          </div>
          <div id="evidence-content" className={evidenceOpen ? 'block' : 'hidden'} aria-hidden={!evidenceOpen}>
          {/* 실시간 뉴스: compact so Insight stays above the fold. 기간 선택 기본 30일 */}
          {currentKeyword && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Newspaper className="h-3.5 w-3.5 text-primary" />
                  실시간 뉴스
                  {rssNewsLoading && (
                    <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      불러오는 중
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1" role="group" aria-label="뉴스 기간 선택">
                  {([7, 14, 30, 90] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewsDays(d)}
                      className={cn(
                        'min-w-[2.25rem] py-1.5 px-2 text-xs font-medium rounded-md border transition-colors',
                        newsDays === d
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
              </div>
              {rssNewsLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3 animate-pulse">
                      <div className="h-3.5 w-full bg-muted rounded mb-2" />
                      <div className="h-3 w-3/4 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              ) : rssNewsFetched && rssNews.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">이 키워드에 대한 실시간 뉴스가 지금은 없습니다. 잠시 뒤에 다시 보시거나, 다른 키워드로 검색해 보세요.</p>
              ) : rssNews.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rssNews.map((item, i) => (
                    <article key={i} className="rounded-lg border border-border bg-card p-3 hover:border-primary/20 transition-colors text-left">
                      <h4 className="font-medium text-foreground text-sm leading-snug line-clamp-2">{item.title || '제목 없음'}</h4>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1.5">
                        <span>{item.source || '언론사'}</span>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                            링크 <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mb-3">시장 분석 · 인사이트 · 종합 리포트</p>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AiTabId)} className="w-full min-w-0">
          <TabsList className="grid w-full max-w-3xl grid-cols-3 h-11 sm:h-12 p-0.5 sm:p-1 gap-0.5 sm:gap-1 bg-muted/60 border border-input mb-4 sm:mb-6">
            {AI_TABS.map(({ id, label, theme, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className={cn('gap-1 sm:gap-2 text-xs sm:text-sm border border-transparent data-[state=active]:bg-background-elevated data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:rounded-b-none px-2 sm:px-3', theme)}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {quotaExceeded ? (
            <div className="mt-6">
              <ErrorState
                variant="warning"
                title="API 사용량이 초과되었습니다"
                description="지금은 분석을 더 진행할 수 없습니다. 설정에서 API 키를 확인하시거나 잠시 뒤에 다시 시도해 주세요."
                recoveryLabel="다시 시도"
                onRecovery={() => {
                  setQuotaExceeded(false)
                  setTabErrorGroq({ logic: null, creative: null, fact: null })
                  setTabErrorGemini({ logic: null, creative: null, fact: null })
                  setTabCacheGroq((prev) => ({ ...prev, [activeTab]: null }))
                  setTabCacheGemini((prev) => ({ ...prev, [activeTab]: null }))
                  fetchTabAnalysis(activeTab as AiTabId, 'all')
                }}
                secondaryAction={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/settings">설정에서 키 확인</Link>
                  </Button>
                }
              />
            </div>
          ) : (
          AI_TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-6 focus-visible:outline-none">
              {(canonicalStatus === 'queued' || canonicalStatus === 'analyzing') ? (
                <div className="rounded-xl border border-border bg-muted/20 py-4">
                  <div className="flex items-center gap-3 py-4">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-pulse" aria-hidden />
                    <p className="text-sm text-muted-foreground">
                      {currentTask?.progress ?? '분석 중'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-foreground mb-3 sm:mb-4 tracking-tight">Groq · Gemini 분석</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 reading-gap-lg">
                    <GroqAnalysis
                        tabId={id}
                      text={(id === 'logic' ? tabCacheGroq.creative ?? (displayResult?.analysis_groq as TabAnalysisRecord)?.creative : tabCacheGroq[id] ?? (displayResult?.analysis_groq as TabAnalysisRecord)?.[id] ?? null) ?? null}
                      loading={!(id === 'logic' ? (tabCacheGroq.creative ?? (displayResult?.analysis_groq as TabAnalysisRecord)?.creative) : (tabCacheGroq[id] ?? (displayResult?.analysis_groq as TabAnalysisRecord)?.[id])) && (tabLoadingGroq[id === 'logic' ? 'creative' : id] || loading)}
                      error={tabErrorGroq[id === 'logic' ? 'creative' : id]}
                      retryCount={retryCountTabGroq[id === 'logic' ? 'creative' : id] ?? 0}
                      onRetry={() => {
                        const tabToFetch = id === 'logic' ? 'creative' : id
                        if ((retryCountTabGroq[tabToFetch] ?? 0) >= 3) {
                          setRetryCountTabGroq((prev) => ({ ...prev, [tabToFetch]: 0 }))
                          setTabErrorGroq((prev) => ({ ...prev, [tabToFetch]: null }))
                        }
                        setTabCacheGroq((prev) => ({ ...prev, [tabToFetch]: null }))
                        fetchTabAnalysis(tabToFetch, 'groq', { isReanalyze: true })
                      }}
                    />
                    <GeminiAnalysis
                        tabId={id}
                      text={(id === 'logic' ? tabCacheGemini.creative ?? (displayResult?.analysis_gemini as TabAnalysisRecord)?.creative : tabCacheGemini[id] ?? (displayResult?.analysis_gemini as TabAnalysisRecord)?.[id] ?? null) ?? null}
                      loading={!(id === 'logic' ? (tabCacheGemini.creative ?? (displayResult?.analysis_gemini as TabAnalysisRecord)?.creative) : (tabCacheGemini[id] ?? (displayResult?.analysis_gemini as TabAnalysisRecord)?.[id])) && (tabLoadingGemini[id === 'logic' ? 'creative' : id] || loading)}
                      error={tabErrorGemini[id === 'logic' ? 'creative' : id]}
                      retryCount={retryCountTabGemini[id === 'logic' ? 'creative' : id] ?? 0}
                      quotaExceeded={geminiQuotaExceeded}
                      onRetry={() => {
                        const tabToFetch = id === 'logic' ? 'creative' : id
                        if (tabErrorGemini[tabToFetch] === '무료 쿼터 초과') {
                          setGeminiQuotaExceeded(false)
                          setTabErrorGemini((prev) => ({ ...prev, [tabToFetch]: null }))
                        }
                        if ((retryCountTabGemini[tabToFetch] ?? 0) >= 3) {
                          setRetryCountTabGemini((prev) => ({ ...prev, [tabToFetch]: 0 }))
                          setTabErrorGemini((prev) => ({ ...prev, [tabToFetch]: null }))
                        }
                        setTabCacheGemini((prev) => ({ ...prev, [tabToFetch]: null }))
                        fetchTabAnalysis(tabToFetch, 'gemini', { isReanalyze: true })
                      }}
                    />
                  </div>
                  {id === 'creative' && (
                    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 mt-4 sm:mt-6">
                      <p className="text-sm font-medium text-foreground mb-2 sm:mb-3">추가 질문 (선택)</p>
                      <div className="flex flex-col sm:flex-row gap-2" aria-busy={followUpLoading}>
                        <Input
                          type="text"
                          aria-label="추가 질문"
                          placeholder={followUpLoading ? '답변 생성 중…' : '질문을 입력하세요'}
                          value={followUpQuestion}
                          onChange={(e) => setFollowUpQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                          disabled={followUpLoading}
                          className="flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleFollowUp}
                          disabled={followUpLoading || !followUpQuestion.trim()}
                          aria-busy={followUpLoading}
                        >
                          {followUpLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              답변 중...
                            </>
                          ) : (
                            '질문하기'
                          )}
                        </Button>
                      </div>
                      {followUps.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {followUps.map((item, i) => (
                            <div key={i} className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                              <p className="text-sm text-muted-foreground text-muted-foreground font-medium">Q. {item.question}</p>
                              <p className="text-foreground whitespace-pre-wrap text-sm">{item.answer}</p>
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
          </div>
        </section>

        {/* Next steps: concise list. */}
        {displayStatus === 'done' && displayResult && (consensusData?.strategicSummary?.actionItems?.length ?? 0) > 0 && (
          <section className="reading-section-gap pt-4 border-t border-border/60" aria-label="Next steps">
            <button
              type="button"
              onClick={() => setImplicationOpen((o) => !o)}
              className="lg:sr-only w-full flex items-center justify-between gap-2 min-h-[44px] py-2 text-left mb-2 touch-manipulation text-sm text-muted-foreground"
              aria-expanded={implicationOpen}
              aria-controls="implication-content"
            >
              다음 단계
              {implicationOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <div className="hidden lg:block mb-2">
              <h2 className="text-sm font-medium text-foreground">다음 단계</h2>
            </div>
            <div id="implication-content" className={cn(implicationOpen ? 'block' : 'hidden', 'lg:block')} aria-hidden={!implicationOpen}>
              <ul className="space-y-1 list-none pl-0 text-sm text-foreground">
                {(consensusData?.strategicSummary?.actionItems ?? []).slice(0, 3).map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary shrink-0">·</span>
                    <span className="break-words">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-2">추가 질문은 인사이트 탭에서 이용하세요.</p>
            </div>
          </section>
        )}

        {/* Small screens: jump back to summary after partial reading (interrupted usage). */}
        {displayStatus === 'done' && displayResult && (
          <div className="lg:hidden flex justify-center py-3">
            <a
              href="#insight-summary"
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              요약으로 돌아가기
            </a>
          </div>
        )}

        {selectedNews && (
          <NewsDetailModal
            item={selectedNews}
            preSummary={
              selectedNewsIndex != null && displayResult?.articleSummaries?.[selectedNewsIndex]
                ? displayResult.articleSummaries[selectedNewsIndex]
                : null
            }
            onClose={() => {
              setSelectedNews(null)
              setSelectedNewsIndex(null)
            }}
          />
        )}

        {saveInsightOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="save-insight-title">
            <div className="absolute inset-0 bg-black/50" onClick={() => !saveInsightSaving && setSaveInsightOpen(false)} aria-hidden />
            <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-lg p-4 sm:p-5 flex flex-col gap-4">
              <h2 id="save-insight-title" className="text-sm font-semibold text-foreground">인사이트로 저장</h2>
              <p className="text-xs text-muted-foreground">이름과 메모와 함께 저장해 연구 노트처럼 나중에 참고할 수 있습니다.</p>
              <p className="text-[11px] text-muted-foreground">저장 시점: {currentKeyword} · 시장 온도/요약 포함</p>
              <div>
                <label htmlFor="save-insight-name" className="block text-xs font-medium text-foreground mb-1">이름 (필수)</label>
                <Input
                  id="save-insight-name"
                  value={saveInsightName}
                  onChange={(e) => setSaveInsightName(e.target.value)}
                  placeholder="예: 2월 시장 전망"
                  className="bg-background border-border text-foreground"
                  disabled={saveInsightSaving}
                />
              </div>
              <div>
                <label htmlFor="save-insight-note" className="block text-xs font-medium text-foreground mb-1">메모 (선택)</label>
                <textarea
                  id="save-insight-note"
                  value={saveInsightNote}
                  onChange={(e) => setSaveInsightNote(e.target.value)}
                  placeholder="나중에 참고할 짧은 메모"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={saveInsightSaving}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => !saveInsightSaving && setSaveInsightOpen(false)} disabled={saveInsightSaving}>
                  취소
                </Button>
                <Button type="button" size="sm" onClick={handleSaveInsightSubmit} disabled={!saveInsightName.trim() || saveInsightSaving} className="gap-1.5">
                  {saveInsightSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
                  저장
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>
          </div>

          {/* 우측: 보조 맥락만 (트렌드, 수치, 출처). 메인 인사이트는 왼쪽 컬럼에만. */}
          <div className="lg:col-span-4 reading-space-y bg-transparent rounded-xl p-0 sm:p-1 min-w-0">
            <div className="lg:hidden rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 min-h-[44px] p-3 sm:p-4 text-left hover:bg-muted/50 transition-colors touch-manipulation"
                aria-expanded={sidebarOpen}
                aria-controls="results-sidebar-content"
              >
                <span className="text-sm font-medium text-muted-foreground">참고: 트렌드 · 수치 · 출처</span>
                {sidebarOpen ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
              </button>
            </div>
            <div id="results-sidebar-content" className={cn('reading-space-y', sidebarOpen ? 'block' : 'hidden', 'lg:block')} aria-hidden={!sidebarOpen}>
            {/* Analysis quality: trustworthiness score (fact coverage, signal consistency, hypothesis discipline, uncertainty disclosure). */}
            {displayStatus === 'done' && displayResult && (() => {
              const qualityInput = {
                marketNews: displayResult?.marketNews ?? consensusData?.marketNews,
                painPoints: displayResult?.painPoints ?? consensusData?.painPoints,
                competitorTrends: displayResult?.competitorTrends ?? consensusData?.competitorTrends,
                sentiment: consensusData?.sentiment ?? (displayResult?.key_metrics?.sentiment != null ? { score: (displayResult.key_metrics.sentiment - 50) * 2 } : undefined),
                impactAnalysis: consensusData?.impactAnalysis ?? displayResult?.key_metrics?.chartData?.impact,
                strategicSummary: consensusData?.strategicSummary,
                metadata: consensusData?.metadata,
              }
              const quality = computeAnalysisQualityScore(qualityInput)
              return (
                <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">분석 품질</h3>
                  <AnalysisQualityIndicator quality={quality} compact />
                </div>
              )
            })()}
            {/* Market Temperature: score, trend, explanation from AI JSON (key_metrics) or consensus. */}
            <div className="rounded-xl border border-border/60 bg-card/50 p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">시장 온도</h3>
              <MarketTemperature
                score={
                  typeof consensusData?.sentiment?.score === 'number'
                    ? consensusData.sentiment.score
                    : displayResult?.key_metrics?.market_temperature_score != null
                      ? (displayResult.key_metrics.market_temperature_score - 50) * 2
                      : (displayResult?.key_metrics?.sentiment != null || displayResult?.sentiment != null)
                        ? (Number(displayResult?.key_metrics?.sentiment ?? displayResult?.sentiment ?? 50) - 50) * 2
                        : null
                }
                trend={consensusData?.sentiment?.trend ?? 'stable'}
                factors={consensusData?.sentiment?.ratio ?? displayResult?.key_metrics?.chartData?.sentiment ?? displayResult?.chartData?.sentiment}
                positiveSignals={
                  (displayResult?.key_metrics?.positive_signals?.length ?? 0) > 0
                    ? (displayResult?.key_metrics?.positive_signals ?? [])
                    : (consensusData?.marketNews?.length ?? 0) > 0
                      ? (consensusData?.marketNews ?? []).slice(0, 3)
                      : []
                }
                neutralSignals={displayResult?.key_metrics?.neutral_signals ?? []}
                negativeRisks={
                  (displayResult?.key_metrics?.negative_risks?.length ?? 0) > 0
                    ? (displayResult?.key_metrics?.negative_risks ?? [])
                    : (consensusData?.painPoints?.length ?? 0) > 0
                      ? (consensusData?.painPoints ?? []).slice(0, 3)
                      : []
                }
                loading={loading}
              />
            </div>
            <div className="rounded-xl border border-border/60 bg-card/50 p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">실시간 트렌드</h3>
              {(sharedTrends.KR.length + sharedTrends.US.length + sharedTrends.JP.length) > 0 ? (
                <>
                  <ul className="space-y-2 mb-3">
                    {([...sharedTrends.KR, ...sharedTrends.US, ...sharedTrends.JP] as TrendItem[]).slice(0, 6).map((item, i) => (
                      <li key={`${item.keyword}-${i}`}>
                        <div className="rounded-md border border-border/40 bg-muted/10 p-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/results?keyword=${encodeURIComponent(item.keyword)}`}
                              className="text-sm font-medium text-foreground truncate hover:text-primary"
                            >
                              {item.keyword}
                            </Link>
                            {countryFromUrl !== 'KR' && item.title_ko != null && item.title_ko !== item.keyword && (
                              <>
                                <span className="text-muted-foreground">·</span>
                                <span className="text-xs text-muted-foreground truncate" title="한국어 번역">
                                  {item.title_ko}
                                </span>
                              </>
                            )}
                            {item.search_volume != null && (
                              <span className="text-xs shrink-0 tabular-nums text-muted-foreground text-muted-foreground">
                                {item.search_volume}
                              </span>
                            )}
                          </div>
                          {item.started_at && (
                            <p className="text-xs text-muted-foreground text-muted-foreground mt-1">{item.started_at}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground text-muted-foreground">최근 업데이트: <TimeAgo isoString={sharedTrends.updatedAt} /></p>
                  <Link href="/trends" className="text-xs text-primary hover:underline mt-1 inline-block">전체 보기</Link>
                </>
              ) : (
                <p className="text-muted-foreground text-muted-foreground text-xs">트렌드 데이터를 불러오는 중입니다.</p>
              )}
            </div>
            <div className="rounded-xl border border-border/60 bg-card/50 p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">참고 수치</h3>
              <dl className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <dt>감성 지수</dt>
                  <dd className="text-foreground tabular-nums">{displayResult ? (displayResult.key_metrics?.sentiment ?? displayResult.sentiment ?? '—') : '—'}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt>시장 뉴스</dt>
                  <dd className="text-foreground tabular-nums">{displayResult ? (displayResult.marketNews?.length ?? 0) : '—'}건</dd>
                </div>
                <div className="flex justify-between">
                  <dt>페인포인트</dt>
                  <dd className="text-foreground tabular-nums">{displayResult ? (displayResult.painPoints?.length ?? 0) : '—'}건</dd>
                </div>
              </dl>
              <details className="mt-2 pt-2 border-t border-border/50" open>
                <summary className="text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
                  근거
                </summary>
                <p className="text-[11px] text-muted-foreground mt-2">감성: 뉴스·신호 종합 톤. 뉴스·페인포인트: 이 리포트에 반영된 항목 수. 본문 통찰과 함께 보세요.</p>
              </details>
            </div>
            <div className="rounded-xl border border-border/60 bg-card/50 p-4">
              <h3 className="text-xs font-medium text-muted-foreground mb-2">인용 출처</h3>
              {newsList.length === 0 ? (
                <p className="text-muted-foreground text-xs">없음</p>
              ) : (
                <ul className="space-y-1.5">
                  {newsList.map((item, i) => (
                    <li key={i}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate block break-all"
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
      </div>
    )
  }

  if (!hasKeyword) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] bg-background">
        <div className="rounded-2xl border border-border bg-card shadow-sm p-8 max-w-md w-full">
          <EmptyState
            title="키워드를 검색하세요"
            description="검색하면 인사이트 요약을 먼저 볼 수 있습니다. 상세 리포트는 필요할 때 펼쳐보시면 됩니다."
            action={
              <Link href="/">
                <Button variant="outline">홈에서 검색하기</Button>
              </Link>
            }
          />
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
        <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] bg-background">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-8 w-full max-w-md">
            <LoadingState
              message="페이지를 불러오는 중입니다"
              detail="잠시만 기다려 주세요."
              size="lg"
              icon={<RinAnimation variant="loading" size={200} />}
            />
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  )
}
