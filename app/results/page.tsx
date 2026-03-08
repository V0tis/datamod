'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
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
import { computeAnalysisQualityScore } from '@/lib/analysis-quality-score'
import { PMDecisionDashboard } from '@/components/research/PMDecisionDashboard'
import { StrategyEnginePipeline } from '@/components/research/dashboard/StrategyEnginePipeline'
import { FirstFiveSecondsBanner } from '@/components/research/FirstFiveSecondsBanner'
import { AIInsightGenerationSequence } from '@/components/research/AIInsightGenerationSequence'
import { KeyMarketInsightsCard } from '@/components/research/KeyMarketInsightsCard'
import { ResultSummaryCards } from '@/components/research/ResultSummaryCards'
import { AnalysisEngineSection } from '@/components/research/AnalysisEngineSection'
import { DataSourcesSection, type DataSourceSignal } from '@/components/research/DataSourcesSection'
import { ResultSectionNav } from '@/components/research/ResultSectionNav'
import { ResultShareActions } from '@/components/research/ResultShareActions'
import { AnalysisModeSelector } from '@/components/research/analysis-mode-selector'
import { ResultPageHero } from '@/components/research/ResultPageHero'
import { NextExplorationSection } from '@/components/research/NextExplorationSection'
import { OpportunityScoreCard } from '@/components/research/OpportunityScoreCard'
import { OpportunityScoreBreakdown } from '@/components/research/OpportunityScoreBreakdown'
import { SuggestedAnalyses } from '@/components/research/SuggestedAnalyses'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
import { type ConsensusData, normalizeConsensusData } from '@/components/research/ConsensusInsight'
import type { TabAnalysisRecord } from '@/lib/research-types'
import type { InsightSnapshot, InsightQualityScore } from '@/lib/insights-types'

type AiTabId = 'logic' | 'creative' | 'fact'

const QUOTA_TOAST_ID = 'quota-error'
const TAB_ERROR_TOAST_ID = 'tab-analysis-error'
const QUOTA_UNIFIED_MESSAGE = 'API 쿼터가 부족하여 분석을 중단했습니다. 설정에서 키를 확인해 주세요.'

type RssNewsItem = { title: string; link: string; pubDate: string; source: string }

/** rssNews 아이템에 매칭되는 AI 인사이트 반환 (newsList ↔ articleSummaries 매칭, 없으면 분석 요약 기반) */
function getAiInsightForNews(
  rssItem: RssNewsItem,
  newsList: NewsItem[] | undefined,
  articleSummaries: string[] | undefined,
  fallbackText: string
): string {
  if (!newsList?.length || !articleSummaries?.length) return fallbackText
  const t = (rssItem.title ?? '').trim().toLowerCase()
  const link = (rssItem.link ?? '').trim()
  const idx = newsList.findIndex((n) => {
    const nt = (n.title ?? '').trim().toLowerCase()
    const nu = (n.url ?? '').trim()
    return (t && nt && t === nt) || (link && nu && (link === nu || link.startsWith(nu) || nu.startsWith(link)))
  })
  if (idx >= 0 && articleSummaries[idx]?.trim()) return articleSummaries[idx].trim()
  return fallbackText
}

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
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword')
  const keywordTranslated = searchParams.get('keywordTranslated')?.trim() || null
  const countryFromUrl = searchParams.get('country')?.trim() || 'KR'
  const currentTask = useCurrentTask(keyword, countryFromUrl)
  const {
    keyword: storeKeyword,
    status,
    analysisStatus,
    streamingState,
    analysisTasks,
    newsList,
    taskData,
    result,
    error,
    analysisMode,
    setAnalysisMode,
    startStreamingResearch,
    abortAnalysis,
    loadFromHistory,
    hydrateFromStatusResult,
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
  /** AI 분석 과정 모달 (헤더 버튼으로 열기) */
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false)
  /** Mobile: Evidence (뉴스·상세 분석) collapsed by default so Summary + Key findings + Insight stay above the fold. */
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  /** Mobile: Implication (Next steps) collapsed by default; secondary to main insight. */
  const [implicationOpen, setImplicationOpen] = useState(false)
  /** AI 인사이트 생성 시퀀스: 분석 완료 직후 2–4초간 "AI thinking" 연출 후 리포트 표시 */
  const [showInsightSequence, setShowInsightSequence] = useState(false)
  const prevLoadingRef = useRef<boolean | null>(null)
  /** Save as Insight modal */
  const [saveInsightOpen, setSaveInsightOpen] = useState(false)
  const [saveInsightName, setSaveInsightName] = useState('')
  const [saveInsightNote, setSaveInsightNote] = useState('')
  const [saveInsightSaving, setSaveInsightSaving] = useState(false)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [engineExpanded, setEngineExpanded] = useState(false)

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
    fetch('/api/settings', { cache: 'no-store', credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { aiPrimaryModel?: 'gemini' | 'groq' } | null) => {
        if (data?.aiPrimaryModel === 'groq') setAiPrimaryModel('groq')
      })
      .catch(() => {})
  }, [])

  const handleAiPrimaryChange = async (value: 'gemini' | 'groq') => {
    setAiPrimaryModel(value)
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ai_primary_model: value }) })
      if (!res.ok) throw new Error('저장 실패')
    } catch {
      setAiPrimaryModel((v) => (v === value ? (value === 'groq' ? 'gemini' : 'groq') : v))
    }
  }

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

  // URL keyword·country: load from history only. NEVER auto-run analysis.
  // Analysis runs only when user explicitly clicks "Run Analysis" (home or results page).
  const [historyLoadDone, setHistoryLoadDone] = useState(false)
  const [hasCachedResult, setHasCachedResult] = useState<boolean | null>(null)

  /** AI 우선 분석 (Gemini / Groq) - 설정 페이지와 동기화 */
  const [aiPrimaryModel, setAiPrimaryModel] = useState<'gemini' | 'groq'>('gemini')
  /** 폴링: 백그라운드 분석 진행 상태 추적 (2초마다). 새 탭/새로고침 시 스트리밍 상태 없이 진행 확인 */
  const [polledStatus, setPolledStatus] = useState<'pending' | 'running' | 'completed' | 'failed' | null>(null)
  const [polledProgressStep, setPolledProgressStep] = useState(0)
  const [polledError, setPolledError] = useState<string | null>(null)

  useEffect(() => {
    const k = (keyword ?? storeKeyword)?.trim()
    if (!k) {
      setHistoryLoadDone(true)
      setHasCachedResult(null)
      setPolledStatus(null)
      setPolledError(null)
      return
    }
    setHistoryLoadDone(false)
    setHasCachedResult(null)
    setPolledStatus(null)
    setPolledError(null)
    const countryCode = countryFromUrl
    loadFromHistory(k, countryCode).then((status) => {
      setHistoryLoadDone(true)
      setHasCachedResult(status === 'cached')
    })
  }, [keyword, storeKeyword, countryFromUrl, loadFromHistory])

  // Poll analysis status when we have keyword but no result (detects background analysis on refresh/new tab)
  useEffect(() => {
    const k = (keyword ?? storeKeyword)?.trim()
    const countryCode = countryFromUrl
    if (!k || !historyLoadDone || displayResult?.reportId) return
    if (polledStatus === 'completed' || polledStatus === 'failed') return

    const poll = async () => {
      try {
        const res = await fetch(`/api/analysis/status?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(countryCode)}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return
        const status = data.status as 'pending' | 'running' | 'completed' | 'failed'
        const step = typeof data.progressStep === 'number' ? data.progressStep : 0
        setPolledStatus(status)
        setPolledProgressStep(step)
        if (status === 'completed') {
          if (data.result?.reportId) {
            hydrateFromStatusResult(k, countryCode, data.result)
          }
          await loadFromHistory(k, countryCode)
        }
        if (status === 'failed') {
          setPolledError(data.error ?? '분석이 실패했습니다.')
        }
      } catch {
        // ignore network errors, will retry
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [
    keyword,
    storeKeyword,
    countryFromUrl,
    historyLoadDone,
    displayResult?.reportId,
    polledStatus,
    loadFromHistory,
    hydrateFromStatusResult,
  ])

  // 분석 완료 시 결과 데이터 자동 리프레시 (streaming 완료 → DB에 저장된 전체 결과 로드)
  // DB 쓰기가 비동기이므로 즉시 + 600ms 후 재시도로 렌더 버그 방지
  const prevStreamingCompletedRef = useRef(false)
  useEffect(() => {
    const k = (keyword ?? storeKeyword)?.trim()
    if (!k) return
    const justCompleted =
      streamingState.status === 'completed' && !prevStreamingCompletedRef.current
    prevStreamingCompletedRef.current = streamingState.status === 'completed'
    if (justCompleted) {
      loadFromHistory(k, countryFromUrl)
      const t = setTimeout(() => loadFromHistory(k, countryFromUrl), 600)
      return () => clearTimeout(t)
    }
  }, [keyword, storeKeyword, countryFromUrl, streamingState.status, loadFromHistory])

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
    const fetchKey = `${q}|${days}|${countryFromUrl}`
    if (lastRssFetchKeyRef.current === fetchKey) return
    lastRssFetchKeyRef.current = fetchKey
    setRssNewsLoading(true)
    setRssNewsFetched(false)
    fetch(`/api/news?keyword=${encodeURIComponent(q)}&days=${days}&country=${encodeURIComponent(countryFromUrl)}`)
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
  }, [keyword, storeKeyword, newsDays, countryFromUrl])

  const loading = canonicalStatus === 'queued' || canonicalStatus === 'analyzing' || polledStatus === 'running'
  const hasKeyword = Boolean((currentKeyword ?? '').trim())
  const showPolledError = polledStatus === 'failed'
  const hasFailure = canonicalStatus === 'failed' || showPolledError
  const needsRunAction = historyLoadDone && hasCachedResult === false && !loading && !displayResult?.reportId && hasKeyword && !hasFailure

  /** 분석 완료 직후 AI 인사이트 생성 시퀀스 표시 (loading → done 전환 시) */
  useEffect(() => {
    const wasLoading = prevLoadingRef.current ?? false
    prevLoadingRef.current = loading
    if (wasLoading && !loading && displayResult && !hasFailure && hasKeyword && !needsRunAction) {
      setShowInsightSequence(true)
    }
  }, [loading, displayResult, hasFailure, hasKeyword, needsRunAction])

  /** 키워드 변경 시 시퀀스 리셋 */
  useEffect(() => {
    if (currentKeyword) setShowInsightSequence(false)
  }, [currentKeyword])
  /** non-KR 트렌드 시 원문+번역 둘 다 표시. keywordTranslated(URL) 우선, 없으면 sharedTrends에서 매칭 */
  const translatedForHeader =
    keywordTranslated && (currentKeyword ?? '').trim() && keywordTranslated !== (currentKeyword ?? '').trim()
      ? keywordTranslated
      : countryFromUrl !== 'KR' && (currentKeyword ?? '').trim()
        ? (() => {
            const list: TrendItem[] =
              countryFromUrl === 'US' ? sharedTrends.US
              : countryFromUrl === 'JP' ? sharedTrends.JP
              : countryFromUrl === 'TW' ? sharedTrends.TW
              : countryFromUrl === 'HK' ? sharedTrends.HK
              : countryFromUrl === 'GB' ? sharedTrends.GB
              : countryFromUrl === 'DE' ? sharedTrends.DE
              : []
            const found = list.find((t: TrendItem) => (t.keyword ?? '').trim() === (currentKeyword ?? '').trim())
            return found?.title_ko != null && found.title_ko !== found.keyword ? found.title_ko : null
          })()
        : null
  /** 헤더 타이틀: 번역 있으면 "번역 (원문)", 없으면 원문만 */
  const heroTitle =
    translatedForHeader && (currentKeyword ?? '').trim()
      ? `${translatedForHeader} (${(currentKeyword ?? '').trim()})`
      : (currentKeyword ?? '').trim()

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
      try {
        const res = await fetch('/api/research/insights/tab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
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
        setConsensusData(null)
        setTabErrorGroq((prev) => ({ ...prev, creative: null }))
        setTabErrorGemini((prev) => ({ ...prev, creative: null }))
        creativeFetchedForConsensusRef.current = null
        isConsensusStartedRef.current = false
        await fetchTabAnalysis('creative', 'all', { isReanalyze: true })
        return
      }
      const historyStatus = await loadFromHistory(k, countryFromUrl)
      if (historyStatus === 'cached') {
        const cachedResult = useResearchStore.getState().result
        if (cachedResult?.reportId) {
          const cachedSummary = [
            cachedResult.marketNews?.length ? `시장 뉴스 요약: ${cachedResult.marketNews.join(' ')}` : '',
            cachedResult.painPoints?.length ? `유저 페인포인트: ${cachedResult.painPoints.join(' ')}` : '',
            cachedResult.competitorTrends ? `경쟁사 동향: ${cachedResult.competitorTrends}` : '',
          ].filter(Boolean).join('\n\n')
          setConsensusData(null)
          setTabErrorGroq((prev) => ({ ...prev, creative: null }))
          setTabErrorGemini((prev) => ({ ...prev, creative: null }))
          creativeFetchedForConsensusRef.current = null
          isConsensusStartedRef.current = false
          await fetchTabAnalysis('creative', 'all', { isReanalyze: true, reportId: cachedResult.reportId, summary: cachedSummary })
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

  const dataSourceSignals = ((): DataSourceSignal[] => {
    const kw = (currentKeyword ?? '').trim()
    const allTrends = [...sharedTrends.KR, ...sharedTrends.US, ...sharedTrends.JP] as TrendItem[]
    const hasTrendMatch = kw && allTrends.some((t) => (t.keyword ?? '').trim().toLowerCase() === kw.toLowerCase())
    const fundingScore = displayResult?.key_metrics?.opportunity_score_breakdown?.funding_signals
    const fundingNum = typeof fundingScore === 'number' ? fundingScore : null

    return [
      {
        id: 'google-trends',
        source: '구글 트렌드',
        summary: hasTrendMatch
          ? '이 키워드에 대한 검색 관심도·볼륨 데이터가 분석에 반영되었습니다.'
          : allTrends.length > 0
            ? '전역 트렌드 컨텍스트가 분석에 사용되었습니다. 현재 키워드는 트렌드 목록에 없을 수 있습니다.'
            : '이 키워드에 대한 트렌드 데이터가 없습니다.',
        confidence: hasTrendMatch ? 'high' : allTrends.length > 0 ? 'medium' : 'low',
        usedInAnalysis: hasTrendMatch || allTrends.length > 0,
      },
      {
        id: 'vc-funding',
        source: '스타트업 투자 데이터',
        summary: fundingNum != null
          ? `투자 신호 점수(${fundingNum})가 기회 점수에 반영되었습니다.`
          : '본 분석에 전용 VC 투자 신호가 없습니다.',
        confidence: fundingNum != null ? (fundingNum >= 70 ? 'high' : fundingNum >= 40 ? 'medium' : 'low') : 'low',
        usedInAnalysis: fundingNum != null,
      },
    ]
  })()

  const showTabs = hasKeyword
  if (showTabs) {
    return (
      <div className="px-4 py-4 sm:px-5 sm:py-5 md:p-6 min-h-screen bg-background rin-doc">
        {/* Reading mode: grid gap and main column spacing use CSS variables from data-reading-mode */}
        <div className="mx-auto max-w-[1600px] reading-gap-lg">
          <div className="reading-space-y-lg bg-card rounded-xl p-0 sm:p-1 min-w-0">
        <div id="pm-dashboard-top" className="rounded-lg border border-border bg-card shadow-sm p-5 sm:p-6 md:p-7 transition-colors duration-200 rin-reading reading-space-y-lg reading-text">
        {/* 1. Result Page Hero – final AI conclusion in ~3 seconds */}
        {(displayResult != null || loading || (analysisTasks?.length ?? 0) > 0) && !needsRunAction && (
          <ResultPageHero
            title={heroTitle}
            opportunityScore={
              typeof displayResult?.key_metrics?.opportunity_score === 'number'
                ? displayResult.key_metrics.opportunity_score
                : null
            }
            confidenceScore={
              (() => {
                const km = displayResult?.key_metrics
                const ar = displayResult?.analysis_results as { confidence?: number } | undefined
                if (typeof km?.confidence_score === 'number') return km.confidence_score
                const c = ar?.confidence
                if (typeof c === 'number') return c <= 1 ? c * 100 : c
                const mc = consensusData?.metadata?.confidence
                if (mc != null && typeof mc === 'number') return mc <= 1 ? mc * 100 : mc
                return displayResult ? 75 : null
              })()
            }
            topInsight={
              (consensusData?.strategicSummary?.summary ?? displayResult?.key_metrics?.summary_insights ?? (displayResult?.key_metrics?.keyConclusions ?? displayResult?.keyConclusions)?.[0] ?? '').trim() || null
            }
            statusText={
              (canonicalStatus as string) === 'queued' || (canonicalStatus as string) === 'analyzing' || (polledStatus as string) === 'running'
                ? (streamingState.status === 'running' || streamingState.status === 'streaming'
                    ? getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep)
                    : (currentTask?.progress ?? 'AI가 단계별로 분석하고 있습니다'))
                : canonicalStatus === 'completed' && displayResult?.updated_at
                  ? <>마지막 업데이트: <TimeAgo isoString={displayResult.updated_at} /></>
                  : canonicalStatus === 'failed'
                    ? '분석 실패'
                    : undefined
            }
            loading={loading && !displayResult}
            actions={
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2" role="group" aria-label="AI 우선 분석">
                  <span className="text-[11px] font-medium text-muted-foreground">AI 우선:</span>
                  <div className="flex gap-0.5 p-0.5 rounded-md bg-muted/50">
                    {(['gemini', 'groq'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleAiPrimaryChange(v)}
                        disabled={loading}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                          aiPrimaryModel === v ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        )}
                      >
                        {v === 'gemini' ? 'Gemini' : 'Groq'}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPipelineModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  AI 분석 과정
                </Button>
                <ResultShareActions
                  reportId={displayResult?.reportId ?? null}
                  summaryText={[
                    currentKeyword ? `# ${currentKeyword} 시장 분석 요약` : '',
                    consensusData?.strategicSummary?.summary ?? displayResult?.key_metrics?.summary_insights ?? (displayResult?.key_metrics?.keyConclusions ?? displayResult?.keyConclusions)?.[0] ?? '',
                    reportSummary,
                    displayResult?.key_metrics?.opportunity_score != null
                      ? `\n기회 점수: ${displayResult.key_metrics.opportunity_score}/100`
                      : '',
                  ].filter(Boolean).join('\n\n')}
                  onDownloadPdf={printReportAsPdf}
                  disabled={loading}
                />
              </div>
            }
            className="mb-6 border-b border-border/60 pb-6"
          />
        )}

        {/* AI 인사이트 생성 시퀀스: 분석 완료 직후 2–4초간 연출 후 리포트 표시 */}
        {showInsightSequence && displayResult && (
          <div className="mt-6 mb-6">
            <AIInsightGenerationSequence
              keyword={currentKeyword ?? ''}
              onComplete={() => setShowInsightSequence(false)}
              durationMs={3200}
            />
          </div>
        )}

        {/* 섹션 네비게이션·요약·인사이트·대시보드 (시퀀스 미표시 시에만) */}
        {!showInsightSequence && (
          <>
        {/* 섹션 네비게이션 (sticky) - 긴 리포트 스크롤 탐색 */}
        {(displayResult != null || loading || (analysisTasks?.length ?? 0) > 0) && !needsRunAction && (
          <nav className="sticky top-0 z-10 mt-6 -mx-2 px-2 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60 mb-4">
            <ResultSectionNav variant="compact" />
          </nav>
        )}

        {/* 분석 결과 요약 카드 (핵심 결론 즉시 파악) */}
        {(displayResult != null || loading || (analysisTasks?.length ?? 0) > 0) && !needsRunAction && (
          <section id="section-summary" className="scroll-mt-24 mt-2" aria-label="분석 결과 요약">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              핵심 결론
            </h2>
            <ResultSummaryCards
              result={displayResult}
              consensusData={consensusData ?? undefined}
              taskData={taskData}
              analysisTasks={analysisTasks ?? undefined}
              loading={loading}
            />
            {/* 시각 데이터: 시그널 수, 신뢰도, 리스크 수준, 소스 수 */}
            {displayResult?.key_metrics && (
              <div className="mt-4 flex flex-wrap gap-3">
                {(() => {
                  const km = displayResult.key_metrics
                  const pos = Array.isArray(km.positive_signals) ? km.positive_signals.length : 0
                  const neu = Array.isArray(km.neutral_signals) ? km.neutral_signals.length : 0
                  const neg = Array.isArray(km.negative_risks) ? km.negative_risks.length : 0
                  const totalSignals = pos + neu + neg
                  const conf = typeof km.confidence_score === 'number' ? km.confidence_score : null
                  const riskLevel = neg >= 5 ? '높음' : neg >= 2 ? '중간' : neg >= 1 ? '낮음' : '없음'
                  const sourceCount = (displayResult?.source_links?.length ?? 0) + (newsList?.length ?? 0)
                  const reasoning = (km.opportunity_score_reasoning ?? '').trim()
                  if (totalSignals === 0 && !conf && !reasoning && sourceCount === 0) return null
                  return (
                    <>
                      {totalSignals > 0 && (
                        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 shrink-0">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">시그널</p>
                          <div className="flex gap-3 text-sm">
                            <span className="text-emerald-600 dark:text-emerald-400">긍정 {pos}</span>
                            <span className="text-muted-foreground">중립 {neu}</span>
                            <span className="text-destructive">리스크 {neg}</span>
                          </div>
                        </div>
                      )}
                      {conf != null && (
                        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 shrink-0">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">신뢰도</p>
                          <p className="text-sm font-semibold tabular-nums">{Math.round(conf)}%</p>
                        </div>
                      )}
                      {neg > 0 && (
                        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 shrink-0">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">리스크 수준</p>
                          <p className={cn(
                            'text-sm font-semibold',
                            riskLevel === '높음' && 'text-destructive',
                            riskLevel === '중간' && 'text-amber-600 dark:text-amber-500',
                            riskLevel === '낮음' && 'text-muted-foreground',
                          )}>{riskLevel}</p>
                        </div>
                      )}
                      {sourceCount > 0 && (
                        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 shrink-0">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">소스</p>
                          <p className="text-sm font-semibold tabular-nums">{sourceCount}건</p>
                        </div>
                      )}
                      {reasoning && (
                        <div className="rounded-lg border border-border/60 bg-muted/10 p-4 min-w-0 flex-1 max-w-xl">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">신뢰도 근거</p>
                          <p className="text-sm text-foreground line-clamp-2">{reasoning}</p>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </section>
        )}

        {/* Opportunity Score Breakdown – explains how the score was calculated */}
        {(displayResult != null || loading) && !needsRunAction && (displayResult?.key_metrics?.opportunity_score != null || (displayResult?.key_metrics?.opportunity_score_breakdown && Object.keys(displayResult.key_metrics.opportunity_score_breakdown || {}).length > 0)) && (
          <section id="section-opportunity" className="scroll-mt-24 mt-8" aria-label="기회 점수 분해">
            <OpportunityScoreBreakdown
              score={displayResult?.key_metrics?.opportunity_score ?? null}
              breakdown={displayResult?.key_metrics?.opportunity_score_breakdown ?? undefined}
              useKoreanLabels
            />
          </section>
        )}

        {/* First 5 Seconds UX - 즉시 피드백, AI 분석 시작 확인 */}
        {loading && !(displayResult?.reportId || (analysisTasks ?? []).some((t) => t.status === 'completed' && t.output_data != null) || (taskData?.signal_layer ?? taskData?.trend_analysis ?? taskData?.competition_analysis)) && (
          <div className="mb-4">
            <FirstFiveSecondsBanner
              keyword={currentKeyword ?? ''}
              showMicroInsight
            />
            <p className="text-xs text-muted-foreground mt-3 px-1">
              초기 인사이트는 약 10초 내에 표시됩니다. 전체 분석에는 약 1~3분이 소요될 수 있습니다.
            </p>
          </div>
        )}

        {/* 2. 핵심 시장 인사이트 (결과 우선 배치) */}
        {(displayResult != null || loading || (analysisTasks?.length ?? 0) > 0) && !needsRunAction && (
          <div id="section-insights" className="mt-12 first:mt-0 scroll-mt-24">
            <KeyMarketInsightsCard
              result={displayResult}
              taskData={taskData}
              analysisTasks={analysisTasks ?? undefined}
              newsList={newsList ?? []}
              consensusData={consensusData ?? undefined}
              loading={loading}
              keyword={currentKeyword ?? ''}
            />
          </div>
        )}

        {/* No cache + not analyzing: show Run Analysis CTA. Analysis only runs on explicit user click. */}
        {needsRunAction ? (
          <div className="py-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4">
            <p className="text-muted-foreground text-sm mb-4">
              &quot;{currentKeyword}&quot;에 대한 분석이 없습니다. 분석 깊이를 선택한 뒤 실행하세요.
            </p>
            <div className="w-full max-w-md mb-6">
              <AnalysisModeSelector
                value={analysisMode}
                onChange={setAnalysisMode}
                depthOnly
                showDescription={false}
                className="mb-4"
              />
            </div>
            <Button
              size="lg"
              onClick={() => startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })}
              className="gap-2 mb-6"
            >
              <RefreshCw className="h-4 w-4" />
              분석 실행
            </Button>
            <SuggestedAnalyses
              onSelect={(k) => {
                router.replace(`/results?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(countryFromUrl)}`)
                startStreamingResearch(k, { country_code: countryFromUrl })
              }}
              disabled={loading}
            />
          </div>
        ) : (
          <div role="region" aria-label="AI 리포트" className="mt-12 space-y-12">
            {/* 3~6. 시장 성장 / 경쟁 / 전략 / 리스크 및 기회 (리포트 구조) */}
            <PMDecisionDashboard
              keyword={currentKeyword ?? ''}
              result={displayResult}
              loading={loading}
              streamingState={streamingState}
              polledProgressStep={polledStatus === 'running' ? Math.min(4, Math.max(0, polledProgressStep)) : (canonicalStatus === 'failed' || showPolledError ? Math.min(4, Math.max(0, polledProgressStep)) : undefined)}
              polledStatus={polledStatus}
              hasFailure={canonicalStatus === 'failed' || showPolledError}
              displayResult={displayResult}
              newsList={newsList}
              taskData={taskData}
              consensusData={consensusData}
              onPrint={printReportAsPdf}
              onSaveInsight={handleSaveInsightOpen}
              onReanalyze={() => {
                setPolledStatus(null)
                setPolledError(null)
                startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })
              }}
              onAbort={abortAnalysis}
              reanalyzing={streamingState.status === 'running' || streamingState.status === 'streaming'}
              hasError={canonicalStatus === 'failed' || showPolledError}
              errorStepIndex={
                streamingState.status === 'error' && streamingState.lastSuccessfulStep != null
                  ? streamingState.lastSuccessfulStep + 1
                  : polledProgressStep
              }
              globalErrorMessage={displayError ?? polledError ?? undefined}
            />
            {/* AI 분석 엔진 (토글) */}
            {(displayResult != null || (analysisTasks?.length ?? 0) > 0) && (
              <div className="mt-5 border border-border/60 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEngineExpanded((e) => !e)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
                  aria-expanded={engineExpanded}
                >
                  <span className="text-sm font-semibold text-foreground">AI 분석 엔진</span>
                  {engineExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {engineExpanded && (
                  <div className="p-0">
                    <AnalysisEngineSection analysisTasks={analysisTasks ?? undefined} aiPrimaryModel={aiPrimaryModel} hideHeader className="border-0 rounded-none" />
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* 상세 섹션 (접기/펼치기): 데이터 출처 + 뉴스 */}
        {currentKeyword && (
          <div className="mt-8 border border-border/60 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setDetailExpanded((e) => !e)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
              aria-expanded={detailExpanded}
            >
              <span className="text-sm font-semibold text-foreground">상세 (데이터 출처 · 뉴스)</span>
              {detailExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {detailExpanded && (
              <div className="space-y-6 p-4 pt-0">
                <div id="section-data" className="scroll-mt-24">
                  <DataSourcesSection
                    signals={dataSourceSignals}
                    loading={loading && !displayResult}
                  />
                </div>

                <section id="section-news" className="reading-section-gap rounded-lg border border-border/60 bg-muted/20 p-4 sm:p-5 scroll-mt-24" aria-label="뉴스 및 데이터">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
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
              <p className="text-sm text-muted-foreground py-2">이 키워드에 대한 실시간 뉴스가 지금은 없습니다.</p>
            ) : rssNews.length > 0 ? (
              (() => {
                const kw = (currentKeyword ?? '').trim()
                const fallbackInsight =
                  consensusData?.strategicSummary?.summary?.trim() ||
                  displayResult?.key_metrics?.summary_insights?.trim() ||
                  displayResult?.key_metrics?.keyConclusions?.[0]?.trim() ||
                  (kw ? `이 뉴스는 ${kw} 시장 분석에 참고된 시장 신호입니다.` : '이 뉴스는 시장 동향 분석에 참고된 시장 신호입니다.')
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {rssNews.map((item, i) => {
                      const title = item.title || '제목 없음'
                      const hasKeywordMatch = kw && title.toLowerCase().includes(kw.toLowerCase())
                      const aiInsight = getAiInsightForNews(
                        item,
                        newsList ?? undefined,
                        displayResult?.articleSummaries,
                        fallbackInsight
                      )
                      return (
                        <article key={i} className="rounded-lg border border-border bg-card p-4 hover:border-primary/20 transition-colors text-left">
                          <h4 className="font-medium text-foreground text-sm leading-snug line-clamp-2 mb-1">
                            {hasKeywordMatch && kw ? (
                              title.split(new RegExp(`(${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')).map((part, j) =>
                                part.toLowerCase() === kw.toLowerCase() ? (
                                  <mark key={j} className="bg-primary/20 text-foreground rounded px-0.5">{part}</mark>
                                ) : (
                                  part
                                )
                              )
                            ) : (
                              title
                            )}
                          </h4>
                          <p className="text-xs text-muted-foreground mb-2">{item.source || '언론사'}</p>
                          <div className="rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-2 mb-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80 mb-0.5">AI 인사이트</p>
                            <p className="text-xs text-foreground leading-relaxed line-clamp-3">&quot;{aiInsight}&quot;</p>
                          </div>
                          <div className="flex items-center justify-end text-xs text-muted-foreground">
                            {item.link && (
                              <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                                원문 보기 <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )
              })()
            ) : null}
          </section>
              </div>
            )}
          </div>
        )}

        {/* 다음 탐색: 관련 시장 아이디어 + 다른 시장 분석하기 */}
        {(displayResult != null || loading || (analysisTasks?.length ?? 0) > 0) && !needsRunAction && currentKeyword && (
          <NextExplorationSection
            onSelectKeyword={(k) => {
              router.replace(`/results?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(countryFromUrl)}`)
              startStreamingResearch(k, { country_code: countryFromUrl })
            }}
            onRunAnalysis={(k) => {
              router.replace(`/results?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(countryFromUrl)}`)
              startStreamingResearch(k, { country_code: countryFromUrl })
            }}
            disabled={false}
          />
        )}

          </>
        )}

        {displayStatus === 'done' && displayResult && (
          <div className="lg:hidden flex justify-center py-3">
            <a
              href="#pm-dashboard-top"
              className="text-xs font-medium text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              대시보드로 돌아가기
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

        {/* AI 분석 과정 모달 */}
        {pipelineModalOpen && (displayResult != null || loading || (analysisTasks?.length ?? 0) > 0) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pipeline-modal-title">
            <div className="absolute inset-0 bg-black/50" onClick={() => setPipelineModalOpen(false)} aria-hidden />
            <div className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card shadow-xl flex flex-col">
              <div className="flex items-center justify-between gap-2 p-4 border-b border-border shrink-0">
                <h2 id="pipeline-modal-title" className="text-sm font-semibold text-foreground">AI 분석 과정</h2>
                <Button type="button" variant="ghost" size="icon" onClick={() => setPipelineModalOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <StrategyEnginePipeline
                  keyword={currentKeyword ?? ''}
                  currentStep={
                    polledStatus === 'running' && polledProgressStep != null
                      ? Math.min(6, Math.max(0, polledProgressStep))
                      : streamingState.status === 'running' || streamingState.status === 'streaming'
                        ? streamingState.currentStep
                        : streamingState.status === 'completed' || (displayResult != null && !loading && !hasFailure)
                          ? 6
                          : -1
                  }
                  allCompleted={displayResult != null && !loading && !hasFailure}
                  streamingStepId={
                    streamingState.status === 'running' || streamingState.status === 'streaming'
                      ? streamingState.stepId
                      : undefined
                  }
                  retryMessage={
                    streamingState.status === 'running' || streamingState.status === 'streaming'
                      ? ('retryMessage' in streamingState ? streamingState.retryMessage : undefined)
                      : undefined
                  }
                  taskData={taskData ?? {}}
                  analysisTasks={analysisTasks ?? null}
                  newsList={newsList ?? []}
                  result={displayResult}
                  onRetryStep={() => {
                    setPolledStatus(null)
                    setPolledError(null)
                    startStreamingResearch(currentKeyword ?? '', { country_code: countryFromUrl })
                  }}
                  hasError={hasFailure}
                  errorStepIndex={
                    streamingState.status === 'error' && streamingState.lastSuccessfulStep != null
                      ? streamingState.lastSuccessfulStep + 1
                      : polledProgressStep
                  }
                  globalErrorMessage={displayError ?? polledError ?? undefined}
                />
              </div>
            </div>
          </div>
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

        </div>
      </div>
    )
  }

  if (!hasKeyword) {
    return (
      <div className="p-5 md:p-6 flex flex-col items-center justify-center min-h-[50vh] bg-background">
        <div className="rounded-xl border border-border bg-card shadow-sm p-6 max-w-md w-full">
          <EmptyState
            title="키워드를 검색하세요"
            description="검색하면 인사이트 요약을 먼저 볼 수 있습니다. 상세 리포트는 필요할 때 펼쳐보시면 됩니다."
            action={
              <Link href="/">
                <Button variant="outline">홈에서 검색하기</Button>
              </Link>
            }
          />
          <div className="mt-6 pt-6 border-t border-border">
            <SuggestedAnalyses
              onSelect={(k) => {
                router.replace(`/results?keyword=${encodeURIComponent(k)}&country=KR`)
                startStreamingResearch(k, { country_code: 'KR' })
              }}
            />
          </div>
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
        <div className="p-5 md:p-6 flex flex-col items-center justify-center min-h-[50vh] bg-background">
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 w-full max-w-md">
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
