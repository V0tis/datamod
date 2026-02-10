'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Button } from '@/components/ui/button'
import { ResearchReportView } from '@/components/research-report-view'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useResearchStore, type NewsItem } from '@/lib/stores/research-store'
import { printReportAsPdf } from '@/lib/pdf-export'
import { ResearchCharts } from '@/components/research-charts'
import { MarkdownWithSearchLinks } from '@/components/markdown-with-search-links'
import { FileDown, Share2, X, ExternalLink, TrendingUp, FileText, BarChart3, Lightbulb, CheckSquare, Newspaper, Copy, Loader2, RefreshCw } from 'lucide-react'
import { cn, parseSearchVolumeNum } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { Badge } from '@/components/ui/badge'

function ReportSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-full bg-muted rounded animate-pulse" />
              <div className="h-4 w-4/5 bg-muted rounded animate-pulse" />
              <div className="h-4 w-3/5 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground dark:text-slate-400 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
          린이 읽고 요약하는 중...
        </p>
      </div>
    </div>
  )
}

function TabLoadingPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] text-center">
      <RinAnimation variant="loading" size={200} className="shrink-0" />
      <p className="mt-4 text-muted-foreground dark:text-slate-400 text-sm">준비 중</p>
    </div>
  )
}

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

function ChartSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 bg-muted rounded mb-4" />
        <div className="h-[280px] w-full bg-muted rounded" />
      </div>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="h-6 w-40 bg-muted rounded mb-4" />
        <div className="h-[320px] w-full bg-muted rounded" />
      </div>
      <div className="h-4 w-full max-w-md bg-muted rounded" />
    </div>
  )
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] shadow-lg flex flex-col">
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
                  className="text-xs text-muted-foreground dark:text-slate-400 hover:text-foreground dark:hover:text-white underline"
                >
                  {showRawBody ? '수집된 텍스트 접기' : '수집된 텍스트 보기'}
                </button>
                {showRawBody && (
                  <div className="mt-2 text-xs text-muted-foreground dark:text-slate-400 whitespace-pre-wrap leading-relaxed rounded border border-border dark:border-[#2d2f34] bg-muted/30 dark:bg-[#202226] p-3 max-h-48 overflow-y-auto">
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
    loadReportByKeyword,
  } = useResearchStore()

  const [activeTab, setActiveTab] = useState<AiTabId>('logic')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  /** 탭별 Groq / HF 듀얼 결과 (기존 단일 tabCache 제거) */
  const [tabCacheGroq, setTabCacheGroq] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabCacheHf, setTabCacheHf] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabLoadingGroq, setTabLoadingGroq] = useState<Record<AiTabId, boolean>>({ logic: false, creative: false, fact: false })
  const [tabLoadingHf, setTabLoadingHf] = useState<Record<AiTabId, boolean>>({ logic: false, creative: false, fact: false })
  const [tabErrorGroq, setTabErrorGroq] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabErrorHf, setTabErrorHf] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [retryCountTabGroq, setRetryCountTabGroq] = useState<Record<AiTabId, number>>({ logic: 0, creative: 0, fact: 0 })
  const [retryCountTabHf, setRetryCountTabHf] = useState<Record<AiTabId, number>>({ logic: 0, creative: 0, fact: 0 })
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  /** Groq / Hugging Face 듀얼 분석 결과 (별도 상태) */
  const [analysisGroq, setAnalysisGroq] = useState<{ summary: string; modelName: string } | null>(null)
  const [analysisHf, setAnalysisHf] = useState<{ summary: string; modelName: string } | null>(null)
  const [loadingGroq, setLoadingGroq] = useState(false)
  const [loadingHf, setLoadingHf] = useState(false)
  const [errorGroq, setErrorGroq] = useState<string | null>(null)
  const [errorHf, setErrorHf] = useState<string | null>(null)
  const [retryCountGroq, setRetryCountGroq] = useState(0)
  const [retryCountHf, setRetryCountHf] = useState(0)
  const dualAnalysisFetchedRef = useRef<string | null>(null)
  const [followUps, setFollowUps] = useState<Array<{ question: string; answer: string }>>([])
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [selectedNewsIndex, setSelectedNewsIndex] = useState<number | null>(null)
  const [rssNews, setRssNews] = useState<RssNewsItem[]>([])
  const [sharedTrends, setSharedTrends] = useState<TrendsResponse>({
    KR: [], US: [], JP: [], updatedAt: null,
  })
  const reportFetchedForCacheRef = useRef<string | null>(null)
  const tabAbortControllerRef = useRef<AbortController | null>(null)

  // URL keyword 기준: research_history 캐시 우선 → 없거나 비어있으면 reports 복원 → 없으면 stream 호출
  useEffect(() => {
    const k = (keyword ?? storeKeyword)?.trim()
    if (!k) return
    let cancelled = false
    const countryCode = 'KR'
    loadFromHistory(k, countryCode).then((historyStatus) => {
      if (cancelled) return
      if (historyStatus === 'cached') return
      if (historyStatus === 'empty') {
        startResearch(k, { country_code: countryCode })
        return
      }
      loadReportByKeyword(k).then((fromReport) => {
        if (cancelled) return
        if (!fromReport) startResearch(k, { country_code: countryCode })
      })
    })
    return () => { cancelled = true }
  }, [keyword, loadFromHistory, loadReportByKeyword, startResearch])

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
    if (!q) return
    fetch(`/api/news?keyword=${encodeURIComponent(q)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: RssNewsItem[] } | null) => {
        if (Array.isArray(data?.items)) setRssNews(data.items)
        else setRssNews([])
      })
      .catch(() => setRssNews([]))
  }, [keyword, storeKeyword])

  const loading = status === 'loading'
  const showAnalyzing = loading && !quotaExceeded && !error
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

  // 캐시에서 복원된 result에 듀얼 분석(요약용 summary/modelName)이 있으면 상태에 반영; report 바뀌면 초기화
  useEffect(() => {
    if (!result) {
      setAnalysisGroq(null)
      setAnalysisHf(null)
      return
    }
    const groq = result.analysis_groq as { summary?: string; modelName?: string } | undefined
    const hf = result.analysis_hf as { summary?: string; modelName?: string } | undefined
    setAnalysisGroq(groq?.summary != null ? { summary: groq.summary, modelName: groq.modelName ?? 'Llama-3' } : null)
    setAnalysisHf(hf?.summary != null ? { summary: hf.summary, modelName: hf.modelName ?? 'Mistral' } : null)
  }, [result?.reportId, result?.analysis_groq, result?.analysis_hf])

  const fetchDualAnalysis = useCallback(
    (which: 'groq' | 'hf' | 'both') => {
      const reportId = result?.reportId ?? undefined
      const payload = {
        keyword: currentKeyword ?? '',
        summary: reportSummary,
        reportId,
        newsHeadlines,
      }

      const doGroq = async () => {
        if (retryCountGroq >= 3) return
        setLoadingGroq(true)
        setErrorGroq(null)
        try {
          const res = await fetch('/api/research/analysis/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setRetryCountGroq((prev) => {
              const next = Math.min(prev + 1, 3)
              if (typeof console !== 'undefined') console.warn(`[듀얼 분석 Groq] 재시도 ${next}회차...`)
              return next
            })
            setErrorGroq((data as { error?: string }).error ?? 'Groq 분석에 실패했어요.')
            return
          }
          setRetryCountGroq(0)
          setAnalysisGroq({ summary: (data as { summary?: string }).summary ?? '', modelName: (data as { modelName?: string }).modelName ?? 'Llama-3' })
        } catch (err) {
          setRetryCountGroq((prev) => {
            const next = Math.min(prev + 1, 3)
            if (typeof console !== 'undefined') console.warn(`[듀얼 분석 Groq] 재시도 ${next}회차...`)
            return next
          })
          setErrorGroq('요청 중 오류가 발생했어요.')
          showErrorToast(err, { fallbackMessage: 'Groq 분석에 실패했어요.' })
        } finally {
          setLoadingGroq(false)
        }
      }

      const doHf = async () => {
        if (retryCountHf >= 3) return
        setLoadingHf(true)
        setErrorHf(null)
        try {
          const res = await fetch('/api/research/analysis/hf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setRetryCountHf((prev) => {
              const next = Math.min(prev + 1, 3)
              if (typeof console !== 'undefined') console.warn(`[듀얼 분석 HF] 재시도 ${next}회차...`)
              return next
            })
            setErrorHf((data as { error?: string }).error ?? 'Hugging Face 분석에 실패했어요.')
            return
          }
          setRetryCountHf(0)
          setAnalysisHf({ summary: (data as { summary?: string }).summary ?? '', modelName: (data as { modelName?: string }).modelName ?? 'Mistral' })
        } catch (err) {
          setRetryCountHf((prev) => {
            const next = Math.min(prev + 1, 3)
            if (typeof console !== 'undefined') console.warn(`[듀얼 분석 HF] 재시도 ${next}회차...`)
            return next
          })
          setErrorHf('요청 중 오류가 발생했어요.')
          showErrorToast(err, { fallbackMessage: 'Hugging Face 분석에 실패했어요.' })
        } finally {
          setLoadingHf(false)
        }
      }

      if (which === 'groq') doGroq()
      else if (which === 'hf') doHf()
      else {
        doGroq()
        doHf()
      }
    },
    [currentKeyword, reportSummary, result?.reportId, newsHeadlines, retryCountGroq, retryCountHf]
  )

  // 분석 완료 시 Groq/HF 병렬 호출 (캐시 없을 때만, 1회)
  useEffect(() => {
    const k = (currentKeyword ?? '').trim()
    if (!k || status !== 'done' || !result?.reportId) return
    if (dualAnalysisFetchedRef.current === result.reportId) return
    // DB 캐시(result)에 이미 있으면 호출하지 않음
    const hasGroqFromCache = !!result.analysis_groq
    const hasHfFromCache = !!result.analysis_hf
    if (hasGroqFromCache && hasHfFromCache) {
      dualAnalysisFetchedRef.current = result.reportId
      return
    }
    const shouldFetchGroq = !analysisGroq && !hasGroqFromCache && retryCountGroq < 3 && !loadingGroq
    const shouldFetchHf = !analysisHf && !hasHfFromCache && retryCountHf < 3 && !loadingHf
    if (!shouldFetchGroq && !shouldFetchHf) return
    dualAnalysisFetchedRef.current = result.reportId
    if (shouldFetchGroq && shouldFetchHf) {
      fetchDualAnalysis('both')
    } else if (shouldFetchGroq) {
      fetchDualAnalysis('groq')
    } else {
      fetchDualAnalysis('hf')
    }
  }, [status, result?.reportId, result?.analysis_groq, result?.analysis_hf, currentKeyword, analysisGroq, analysisHf, retryCountGroq, retryCountHf, loadingGroq, loadingHf, fetchDualAnalysis])

  // DB 캐시(result.analysis_groq / analysis_hf) → 탭 듀얼 캐시 동기화 (per-tab 객체)
  useEffect(() => {
    if (!result?.reportId) return
    const groq = result.analysis_groq as Record<string, string> | undefined
    const hf = result.analysis_hf as Record<string, string> | undefined
    if (groq && typeof groq === 'object' && ('logic' in groq || 'creative' in groq || 'fact' in groq)) {
      setTabCacheGroq((prev) => ({
        ...prev,
        logic: typeof groq.logic === 'string' ? groq.logic : prev.logic,
        creative: typeof groq.creative === 'string' ? groq.creative : prev.creative,
        fact: typeof groq.fact === 'string' ? groq.fact : prev.fact,
      }))
    }
    if (hf && typeof hf === 'object' && ('logic' in hf || 'creative' in hf || 'fact' in hf)) {
      setTabCacheHf((prev) => ({
        ...prev,
        logic: typeof hf.logic === 'string' ? hf.logic : prev.logic,
        creative: typeof hf.creative === 'string' ? hf.creative : prev.creative,
        fact: typeof hf.fact === 'string' ? hf.fact : prev.fact,
      }))
    }
  }, [result?.reportId, result?.analysis_groq, result?.analysis_hf])

  const fetchTabAnalysis = useCallback(
    async (tabId: AiTabId, provider: 'groq' | 'hf' | 'both' = 'both') => {
      if (quotaExceeded) return
      if (provider !== 'hf' && retryCountTabGroq[tabId] >= 3) return
      if (provider !== 'groq' && retryCountTabHf[tabId] >= 3) return
      const ac = new AbortController()
      tabAbortControllerRef.current = ac
      if (provider === 'both' || provider === 'groq') setTabLoadingGroq((prev) => ({ ...prev, [tabId]: true }))
      if (provider === 'both' || provider === 'hf') setTabLoadingHf((prev) => ({ ...prev, [tabId]: true }))
      setTabErrorGroq((prev) => ({ ...prev, [tabId]: null }))
      setTabErrorHf((prev) => ({ ...prev, [tabId]: null }))
      const logicText = tabCacheGroq.logic ?? tabCacheHf.logic ?? ''
      const creativeText = tabCacheGroq.creative ?? tabCacheHf.creative ?? ''
      try {
        const res = await fetch('/api/research/insights/tab', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: currentKeyword,
            summary: reportSummary,
            tab: tabId,
            reportId: result?.reportId ?? undefined,
            newsHeadlines: newsHeadlines ?? undefined,
            provider,
            ...(tabId === 'fact' && { logicText, creativeText }),
          }),
          signal: ac.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const errMsg = (data as { error?: string }).error ?? '분석에 실패했습니다.'
          const isQuota = res.status === 429 || (data as { code?: string }).code === 'QUOTA'
          if (isQuota) {
            tabAbortControllerRef.current?.abort()
            setQuotaExceeded(true)
            setTabErrorGroq({ logic: QUOTA_UNIFIED_MESSAGE, creative: QUOTA_UNIFIED_MESSAGE, fact: QUOTA_UNIFIED_MESSAGE })
            setTabErrorHf({ logic: QUOTA_UNIFIED_MESSAGE, creative: QUOTA_UNIFIED_MESSAGE, fact: QUOTA_UNIFIED_MESSAGE })
            setTabLoadingGroq({ logic: false, creative: false, fact: false })
            setTabLoadingHf({ logic: false, creative: false, fact: false })
            toast.error('API 쿼터/요청 한도 초과', {
              id: QUOTA_TOAST_ID,
              description: '잠시 후 다시 시도해 주세요.',
              duration: 6000,
            })
          } else {
            if (provider === 'both' || provider === 'groq') {
              setRetryCountTabGroq((prev) => {
                const next = { ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }
                if (typeof console !== 'undefined') console.warn(`[탭 분석 Groq] 재시도 ${next[tabId]}회차...`)
                return next
              })
              setTabErrorGroq((prev) => ({ ...prev, [tabId]: errMsg }))
            }
            if (provider === 'both' || provider === 'hf') {
              setRetryCountTabHf((prev) => {
                const next = { ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }
                if (typeof console !== 'undefined') console.warn(`[탭 분석 HF] 재시도 ${next[tabId]}회차...`)
                return next
              })
              setTabErrorHf((prev) => ({ ...prev, [tabId]: errMsg }))
            }
            toast.error(errMsg, { id: TAB_ERROR_TOAST_ID, duration: 5000 })
            showErrorToast(data, { fallbackMessage: errMsg })
          }
          return
        }
        const groqText = typeof (data as { groq?: { text?: string } }).groq?.text === 'string' ? (data as { groq: { text: string } }).groq.text : null
        const hfText = typeof (data as { hf?: { text?: string } }).hf?.text === 'string' ? (data as { hf: { text: string } }).hf.text : null
        if (groqText !== null) {
          setTabCacheGroq((prev) => ({ ...prev, [tabId]: groqText }))
          setRetryCountTabGroq((prev) => ({ ...prev, [tabId]: 0 }))
        }
        if (hfText !== null) {
          setTabCacheHf((prev) => ({ ...prev, [tabId]: hfText }))
          setRetryCountTabHf((prev) => ({ ...prev, [tabId]: 0 }))
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const fallback = '분석을 불러오지 못했어요. 다시 시도해 주세요.'
        if (provider === 'both' || provider === 'groq') {
          setRetryCountTabGroq((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
          setTabErrorGroq((prev) => ({ ...prev, [tabId]: fallback }))
        }
        if (provider === 'both' || provider === 'hf') {
          setRetryCountTabHf((prev) => ({ ...prev, [tabId]: Math.min((prev[tabId] ?? 0) + 1, 3) }))
          setTabErrorHf((prev) => ({ ...prev, [tabId]: fallback }))
        }
        toast.error(fallback, { id: TAB_ERROR_TOAST_ID, duration: 5000 })
        showErrorToast(err, { fallbackMessage: fallback })
      } finally {
        setTabLoadingGroq((prev) => ({ ...prev, [tabId]: false }))
        setTabLoadingHf((prev) => ({ ...prev, [tabId]: false }))
      }
    },
    [currentKeyword, reportSummary, result?.reportId, tabCacheGroq, tabCacheHf, newsHeadlines, quotaExceeded, retryCountTabGroq, retryCountTabHf]
  )

  useEffect(() => {
    if (quotaExceeded) return
    const t = activeTab as AiTabId
    if (t !== 'logic' && t !== 'creative' && t !== 'fact') return
    if (status === 'loading') return
    if (status !== 'done' && status !== 'error') return
    const needGroq = !tabCacheGroq[t] && (retryCountTabGroq[t] ?? 0) < 3 && !tabLoadingGroq[t]
    const needHf = !tabCacheHf[t] && (retryCountTabHf[t] ?? 0) < 3 && !tabLoadingHf[t]
    if (!needGroq && !needHf) return
    if (needGroq && needHf) fetchTabAnalysis(t, 'both')
    else if (needGroq) fetchTabAnalysis(t, 'groq')
    else fetchTabAnalysis(t, 'hf')
  }, [activeTab, status, tabCacheGroq, tabCacheHf, tabLoadingGroq, tabLoadingHf, retryCountTabGroq, retryCountTabHf, fetchTabAnalysis, quotaExceeded])

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
    const previousInsights = result?.publicReactionTrends ?? tabCacheGroq.creative ?? tabCacheHf.creative ?? ''
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
  }, [followUpQuestion, followUpLoading, currentKeyword, result?.publicReactionTrends, tabCacheGroq.creative, tabCacheHf.creative])

  const showTabs = !!currentKeyword
  if (showTabs) {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-[#F9FAFB] dark:bg-[#15171a] rin-doc">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main: col-span-8 - 탭/뉴스 영역 배경 dark:bg-[#202226] */}
          <div className="lg:col-span-8 space-y-6 dark:bg-[#202226] rounded-xl p-1">
        <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-6 md:p-8 transition-colors duration-200 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground dark:text-[#e1e3e6] dark:drop-shadow-[0_0_1px_rgba(225,227,230,0.8)]">
            &quot;{currentKeyword}&quot; 검색 결과
          </h1>
          <p className="text-muted-foreground dark:text-slate-400 text-sm mt-1">
            {showAnalyzing
              ? '린이 가져온 뉴스예요. 다른 페이지로 이동해도 분석은 계속돼요.'
              : '탭을 전환해 시장 분석, 인사이트, 종합 리포트를 확인하세요.'}
          </p>
        </header>


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
                  result.keyConclusions?.length ? `핵심 결론\n${result.keyConclusions.join('\n')}` : '',
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
              onClick={() => startResearch(currentKeyword ?? '', { country_code: 'KR' })}
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
          {rssNews.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-foreground dark:text-[#e1e3e6] mb-4 flex items-center gap-2 tracking-tight">
                <Newspaper className="h-4 w-4 text-primary" />
                실시간 뉴스
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rssNews.map((item, i) => (
                  <article
                    key={i}
                    className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] overflow-hidden hover:shadow-md hover:border-primary/20 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-all text-left flex flex-col"
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
            </div>
          )}

          {quotaExceeded ? (
            <div className="mt-6 flex flex-col items-center justify-center min-h-[320px] text-center rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] p-8">
              <p className="text-destructive font-medium">{QUOTA_UNIFIED_MESSAGE}</p>
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
                    setTabErrorHf({ logic: null, creative: null, fact: null })
                    setTabCacheGroq((prev) => ({ ...prev, [activeTab]: null }))
                    setTabCacheHf((prev) => ({ ...prev, [activeTab]: null }))
                    fetchTabAnalysis(activeTab as AiTabId, 'both')
                  }}
                >
                  다시 시도
                </Button>
              </div>
            </div>
          ) : (
          AI_TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-6">
              {showAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <RinAnimation variant="loading" size={140} className="shrink-0" />
                  <p className="mt-3 text-muted-foreground dark:text-slate-400 text-sm">린이 분석하는 중...</p>
                </div>
              ) : (
                <>
                  {id === 'logic' && result?.chartData && (
                    <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] p-6 mb-6">
                      <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">24시간 검색량·감성 추이</h3>
                      <ResearchCharts chartData={result.chartData} />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Groq (Llama-3) 카드 */}
                    <Card className="flex flex-col border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">Groq (Llama-3) 분석 결과</Badge>
                          {tabLoadingGroq[id] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-slate-400" />}
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col gap-4">
                        {tabErrorGroq[id] ? (
                          <>
                            <p className="text-destructive text-sm">{tabErrorGroq[id]}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 mt-auto"
                              disabled={tabLoadingGroq[id] || (retryCountTabGroq[id] ?? 0) >= 3}
                              onClick={() => {
                                if ((retryCountTabGroq[id] ?? 0) >= 3) {
                                  setRetryCountTabGroq((prev) => ({ ...prev, [id]: 0 }))
                                  setTabErrorGroq((prev) => ({ ...prev, [id]: null }))
                                }
                                setTabCacheGroq((prev) => ({ ...prev, [id]: null }))
                                fetchTabAnalysis(id, 'groq')
                              }}
                            >
                              {(retryCountTabGroq[id] ?? 0) >= 3 ? '재분석' : '재시도'}
                            </Button>
                          </>
                        ) : tabLoadingGroq[id] ? (
                          <div className="flex items-center justify-center min-h-[200px]">
                            <RinAnimation variant="loading" size={120} className="shrink-0" />
                          </div>
                        ) : tabCacheGroq[id] ? (
                          <>
                            <div className={cn('prose prose-sm max-w-none text-foreground flex-1', id === 'fact' && 'prose-lg')}>
                              <MarkdownWithSearchLinks text={tabCacheGroq[id]!} />
                            </div>
                            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-muted-foreground dark:text-slate-400"
                                onClick={() => {
                                  const text = tabCacheGroq[id]
                                  if (text) navigator.clipboard.writeText(text).then(() => toast.success('텍스트가 복사되었어요.'))
                                }}
                              >
                                <Copy className="w-3.5 h-3.5" /> 복사
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={tabLoadingGroq[id]}
                                onClick={() => {
                                  setTabCacheGroq((prev) => ({ ...prev, [id]: null }))
                                  fetchTabAnalysis(id, 'groq')
                                }}
                              >
                                <RefreshCw className="w-4 h-4" /> 재시도
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-muted-foreground dark:text-slate-400 text-sm">분석 결과가 없어요. 재시도 버튼으로 요청하세요.</p>
                        )}
                      </CardContent>
                    </Card>
                    {/* Hugging Face 카드 */}
                    <Card className="flex flex-col border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">Hugging Face 분석 결과</Badge>
                          {tabLoadingHf[id] && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-slate-400" />}
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col gap-4">
                        {tabErrorHf[id] ? (
                          <>
                            <p className="text-destructive text-sm">{tabErrorHf[id]}</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 mt-auto"
                              disabled={tabLoadingHf[id] || (retryCountTabHf[id] ?? 0) >= 3}
                              onClick={() => {
                                if ((retryCountTabHf[id] ?? 0) >= 3) {
                                  setRetryCountTabHf((prev) => ({ ...prev, [id]: 0 }))
                                  setTabErrorHf((prev) => ({ ...prev, [id]: null }))
                                }
                                setTabCacheHf((prev) => ({ ...prev, [id]: null }))
                                fetchTabAnalysis(id, 'hf')
                              }}
                            >
                              {(retryCountTabHf[id] ?? 0) >= 3 ? '재분석' : '재시도'}
                            </Button>
                          </>
                        ) : tabLoadingHf[id] ? (
                          <div className="flex items-center justify-center min-h-[200px]">
                            <RinAnimation variant="loading" size={120} className="shrink-0" />
                          </div>
                        ) : tabCacheHf[id] ? (
                          <>
                            <div className={cn('prose prose-sm max-w-none text-foreground flex-1', id === 'fact' && 'prose-lg')}>
                              <MarkdownWithSearchLinks text={tabCacheHf[id]!} />
                            </div>
                            <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-muted-foreground dark:text-slate-400"
                                onClick={() => {
                                  const text = tabCacheHf[id]
                                  if (text) navigator.clipboard.writeText(text).then(() => toast.success('텍스트가 복사되었어요.'))
                                }}
                              >
                                <Copy className="w-3.5 h-3.5" /> 복사
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                disabled={tabLoadingHf[id]}
                                onClick={() => {
                                  setTabCacheHf((prev) => ({ ...prev, [id]: null }))
                                  fetchTabAnalysis(id, 'hf')
                                }}
                              >
                                <RefreshCw className="w-4 h-4" /> 재시도
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-muted-foreground dark:text-slate-400 text-sm">분석 결과가 없어요. 재시도 버튼으로 요청하세요.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  {id === 'creative' && (
                    <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] p-6 mt-6">
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

        {/* Section 3. 핵심 요약: 결론 3가지 Badge */}
        {status === 'done' && result && (result.keyConclusions?.length ?? 0) > 0 && (
          <div className="mt-8 pt-6 border-t border-border dark:border-[#2d2f34]">
            <h2 className="text-sm font-semibold text-foreground mb-3">핵심 요약</h2>
            <div className="flex flex-wrap gap-2">
              {result.keyConclusions!.slice(0, 3).map((line, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal py-2 px-3 max-w-full sm:max-w-md text-left whitespace-normal">
                  {line}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Section 4. 듀얼 AI 분석 (Groq / Hugging Face) */}
        {status === 'done' && result?.reportId && currentKeyword && (
          <div className="mt-8 pt-6 border-t border-border dark:border-[#2d2f34] no-print">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-semibold text-foreground">듀얼 AI 분석</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loadingGroq || loadingHf}
                onClick={() => {
                  setAnalysisGroq(null)
                  setAnalysisHf(null)
                  setErrorGroq(null)
                  setErrorHf(null)
                  setRetryCountGroq(0)
                  setRetryCountHf(0)
                  dualAnalysisFetchedRef.current = null
                  fetchDualAnalysis('both')
                }}
              >
                {(loadingGroq || loadingHf) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    전체 재분석
                  </>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Groq 카드 */}
              <Card className="flex flex-col border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="font-medium">
                      {analysisGroq?.modelName ?? 'Llama-3'}
                    </Badge>
                    {loadingGroq && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-slate-400" />}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  {errorGroq && retryCountGroq >= 3 ? (
                    <p className="text-destructive text-sm">분석에 실패했습니다. 아래 버튼으로 다시 시도하세요.</p>
                  ) : errorGroq ? (
                    <p className="text-destructive text-sm">{errorGroq}</p>
                  ) : analysisGroq?.summary ? (
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap flex-1">
                      {analysisGroq.summary}
                    </div>
                  ) : loadingGroq ? (
                    <div className="flex items-center justify-center py-8">
                      <RinAnimation variant="loading" size={100} className="shrink-0" />
                    </div>
                  ) : (
                    <p className="text-muted-foreground dark:text-slate-400 text-sm">분석 결과가 없어요.</p>
                  )}
                  <div className="mt-auto pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={loadingGroq}
                      onClick={() => {
                        if (retryCountGroq >= 3) {
                          setRetryCountGroq(0)
                          setErrorGroq(null)
                        }
                        setAnalysisGroq(null)
                        fetchDualAnalysis('groq')
                      }}
                    >
                      {loadingGroq ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      이 모델로 다시 분석
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {/* Hugging Face 카드 */}
              <Card className="flex flex-col border-border dark:border-[#2d2f34] bg-card dark:bg-[#202226] dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="font-medium">
                      {analysisHf?.modelName ?? 'Mistral'}
                    </Badge>
                    {loadingHf && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-slate-400" />}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  {errorHf && retryCountHf >= 3 ? (
                    <p className="text-destructive text-sm">분석에 실패했습니다. 아래 버튼으로 다시 시도하세요.</p>
                  ) : errorHf ? (
                    <p className="text-destructive text-sm">{errorHf}</p>
                  ) : analysisHf?.summary ? (
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap flex-1">
                      {analysisHf.summary}
                    </div>
                  ) : loadingHf ? (
                    <div className="flex items-center justify-center py-8">
                      <RinAnimation variant="loading" size={100} className="shrink-0" />
                    </div>
                  ) : (
                    <p className="text-muted-foreground dark:text-slate-400 text-sm">분석 결과가 없어요.</p>
                  )}
                  <div className="mt-auto pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={loadingHf}
                      onClick={() => {
                        if (retryCountHf >= 3) {
                          setRetryCountHf(0)
                          setErrorHf(null)
                        }
                        setAnalysisHf(null)
                        fetchDualAnalysis('hf')
                      }}
                    >
                      {loadingHf ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      이 모델로 다시 분석
                    </Button>
                  </div>
                </CardContent>
              </Card>
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

          {/* Side widgets: col-span-4 - 실시간 트렌드 위젯 (Viva Engage 스타일) */}
          <div className="lg:col-span-4 space-y-4 bg-[#F9FAFB] dark:bg-transparent rounded-xl p-1">
            <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-4 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                실시간 트렌드
              </h3>
              {(sharedTrends.KR.length + sharedTrends.US.length + sharedTrends.JP.length) > 0 ? (
                <>
                  <ul className="space-y-3 mb-3">
                    {([...sharedTrends.KR, ...sharedTrends.US, ...sharedTrends.JP] as TrendItem[]).slice(0, 6).map((item, i) => (
                      <li key={`${item.keyword}-${i}`}>
                        <div className="rounded-lg border border-border dark:border-[#2d2f34] bg-[#F9FAFB] dark:bg-[#202226] p-3 hover:bg-muted/50 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/results?keyword=${encodeURIComponent(item.keyword)}`}
                              className="text-sm font-medium text-foreground dark:text-[#e1e3e6] truncate hover:text-primary dark:hover:text-[#00d19a]"
                            >
                              {item.keyword}
                            </Link>
                            {item.search_volume && (() => {
                              const vol = parseSearchVolumeNum(item.search_volume)
                              const isHigh = vol >= 1000
                              return (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    'text-xs shrink-0 tabular-nums',
                                    isHigh
                                      ? 'dark:bg-[#00d19a]/20 dark:text-[#00d19a] dark:border-[#00d19a]/50 dark:drop-shadow-[0_0_5px_rgba(0,209,154,0.5)]'
                                      : 'dark:bg-[#00d19a]/20 dark:text-[#00d19a] dark:border-[#00d19a]/50 dark:drop-shadow-[0_0_5px_rgba(0,209,154,0.5)]'
                                  )}
                                >
                                  {item.search_volume}
                                </Badge>
                              )
                            })()}
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
            {/* 관련 뉴스 피드 */}
            <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-4 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">관련 뉴스 피드</h3>
              {newsList.length === 0 ? (
                <p className="text-muted-foreground dark:text-slate-400 text-xs">뉴스를 불러오는 중이에요.</p>
              ) : (
                <ul className="space-y-2">
                  {newsList.slice(0, 5).map((item, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => { setSelectedNews(item); setSelectedNewsIndex(i) }}
                        className="w-full text-left text-xs font-medium text-foreground dark:text-[#e1e3e6] hover:text-primary dark:hover:text-[#00d19a] truncate block"
                      >
                        {item.title || '제목 없음'}
                      </button>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground dark:text-slate-400 hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                          출처
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* 핵심 수치 요약 */}
            <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-4 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
              <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-3">핵심 수치 요약</h3>
              {result ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground dark:text-slate-400">감성 지수</dt>
                    <dd className="font-semibold text-foreground dark:text-[#00d19a] dark:drop-shadow-[0_0_5px_rgba(0,209,154,0.5)]">{result.sentiment ?? 0}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground dark:text-slate-400">시장 뉴스</dt>
                    <dd className="font-semibold text-foreground dark:text-[#00d19a] dark:drop-shadow-[0_0_5px_rgba(0,209,154,0.5)]">{result.marketNews?.length ?? 0}건</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground dark:text-slate-400">페인포인트</dt>
                    <dd className="font-semibold text-foreground dark:text-[#00d19a] dark:drop-shadow-[0_0_5px_rgba(0,209,154,0.5)]">{result.painPoints?.length ?? 0}건</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-muted-foreground dark:text-slate-400 text-xs">분석 완료 후 표시돼요.</p>
              )}
            </div>
            {/* 인용된 출처 리스트 */}
            <div className="rounded-xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-4 dark:hover:bg-[#2a2d32] dark:hover:border-[#2d2f34] transition-colors duration-200">
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
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-6 bg-[#F9FAFB] dark:bg-[#15171a]">
        <div className="rounded-2xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-8 text-center max-w-md">
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
        <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-6 bg-[#F9FAFB] dark:bg-[#15171a]">
          <div className="rounded-2xl border border-border dark:border-[#2d2f34] bg-white dark:bg-[#202226] shadow-sm p-8">
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
