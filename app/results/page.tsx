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
import { cn } from '@/lib/utils'
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
        <p className="text-muted-foreground flex items-center gap-2">
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
      <p className="mt-4 text-muted-foreground text-sm">준비 중</p>
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
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card shadow-lg flex flex-col">
        <div className="flex items-start justify-between gap-4 p-4 border-b border-border shrink-0">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* AI 요약: 통합 분석 결과에서만 표시 (summarize-article 호출 없음) */}
          <section>
            <h4 className="text-sm font-semibold text-foreground mb-2">AI 요약</h4>
            {summary ? (
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed rounded-lg bg-primary/5 border border-primary/20 p-4">
                {summary}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
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
            <h4 className="text-sm font-semibold text-foreground mb-2">본문</h4>
            <p className="text-sm text-muted-foreground mb-2">
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
                  <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed rounded border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
                    {item.content}
                  </div>
                )}
              </div>
            )}
            {!item.content && (
              <p className="text-sm text-muted-foreground">수집된 본문이 없어요. 위 링크에서 확인해 주세요.</p>
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
  const [tabCache, setTabCache] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [tabLoading, setTabLoading] = useState<Record<AiTabId, boolean>>({ logic: false, creative: false, fact: false })
  const [tabError, setTabError] = useState<Record<AiTabId, string | null>>({ logic: null, creative: null, fact: null })
  const [quotaExceeded, setQuotaExceeded] = useState(false)
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
      .then((res) => parseJsonResponse<TrendsResponse>(res))
      .then((data) => {
        setSharedTrends({
          KR: normalizeTrendItems(data.KR),
          US: normalizeTrendItems(data.US),
          JP: normalizeTrendItems(data.JP),
          updatedAt: data.updatedAt ?? null,
        })
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

  useEffect(() => {
    if (status !== 'done' || !result?.reportId) return
    const cached = result.ai_responses
    if (cached && (cached.logic ?? cached.creative ?? cached.fact)) {
      setTabCache((prev) => ({
        ...prev,
        logic: cached.logic ?? prev.logic,
        creative: cached.creative ?? prev.creative,
        fact: cached.fact ?? prev.fact,
      }))
      return
    }
    if (reportFetchedForCacheRef.current === result.reportId) return
    reportFetchedForCacheRef.current = result.reportId
    fetch(`/api/reports/${result.reportId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ai_responses?: Record<string, string> } | null) => {
        if (!data?.ai_responses) return
        setTabCache((prev) => ({
          ...prev,
          logic: data.ai_responses!.logic ?? prev.logic,
          creative: data.ai_responses!.creative ?? prev.creative,
          fact: data.ai_responses!.fact ?? prev.fact,
        }))
      })
      .catch(() => {})
  }, [status, result?.reportId, result?.ai_responses])

  const fetchTabAnalysis = useCallback(
    async (tabId: AiTabId) => {
      if (quotaExceeded || tabCache[tabId] || tabLoading[tabId]) return
      const ac = new AbortController()
      tabAbortControllerRef.current = ac
      setTabLoading((prev) => ({ ...prev, [tabId]: true }))
      setTabError((prev) => ({ ...prev, [tabId]: null }))
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
            ...(tabId === 'fact' && {
              logicText: tabCache.logic ?? undefined,
              creativeText: tabCache.creative ?? undefined,
            }),
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
            setTabError({ logic: QUOTA_UNIFIED_MESSAGE, creative: QUOTA_UNIFIED_MESSAGE, fact: QUOTA_UNIFIED_MESSAGE })
            setTabLoading({ logic: false, creative: false, fact: false })
            toast.error('Gemini 쿼터/요청 한도 초과', {
              id: QUOTA_TOAST_ID,
              description: '잠시 후 다시 시도해 주세요.',
              duration: 6000,
            })
          } else {
            const message = errMsg
            setTabError((prev) => ({ ...prev, [tabId]: message }))
            toast.error(message, { id: TAB_ERROR_TOAST_ID, duration: 5000 })
            showErrorToast(data, { fallbackMessage: message })
          }
          return
        }
        const text = typeof (data as { text?: string }).text === 'string' ? (data as { text: string }).text : ''
        const usedFallback = (data as { fallback?: boolean }).fallback === true
        if (usedFallback && tabId === 'logic') {
          toast.info('최적의 모델로 전환하여 분석 중입니다…')
        }
        setTabCache((prev) => ({ ...prev, [tabId]: text }))
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        const fallback = '분석을 불러오지 못했어요. 다시 시도해 주세요.'
        setTabError((prev) => ({ ...prev, [tabId]: fallback }))
        toast.error(fallback, { id: TAB_ERROR_TOAST_ID, duration: 5000 })
        showErrorToast(err, { fallbackMessage: fallback })
      } finally {
        setTabLoading((prev) => ({ ...prev, [tabId]: false }))
      }
    },
    [currentKeyword, reportSummary, result?.reportId, tabCache, tabLoading, newsHeadlines, quotaExceeded]
  )

  useEffect(() => {
    if (quotaExceeded) return
    const t = activeTab as AiTabId
    if ((t === 'logic' || t === 'creative' || t === 'fact') && !tabCache[t] && !tabLoading[t] && (status === 'done' || status === 'error')) {
      fetchTabAnalysis(t)
    }
  }, [activeTab, status, tabCache, tabLoading, fetchTabAnalysis, quotaExceeded])

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
    const previousInsights = result?.publicReactionTrends ?? tabCache.creative ?? ''
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
  }, [followUpQuestion, followUpLoading, currentKeyword, result?.publicReactionTrends, tabCache.creative])

  const showTabs = !!currentKeyword
  if (showTabs) {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-[#F9FAFB] rin-doc">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main: col-span-8 */}
          <div className="lg:col-span-8 space-y-6">
        <div className="rounded-xl border border-border bg-white shadow-sm p-6 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            &quot;{currentKeyword}&quot; 검색 결과
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
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
          <div className="no-print w-full flex flex-wrap items-center gap-3 mb-4 pb-2 border-b border-border">
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
              <span className="text-xs text-muted-foreground">
                마지막 업데이트: <TimeAgo isoString={result.updated_at} />
              </span>
            )}
          </div>
        ) : null}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AiTabId)} className="w-full">
          <TabsList className="grid w-full max-w-3xl grid-cols-3 h-12 p-1 gap-1 bg-muted/60">
            {AI_TABS.map(({ id, label, theme, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className={cn('gap-2 border border-transparent', theme)}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* 실시간 뉴스: 탭 리스트 바로 아래, 분석 콘텐츠 위 */}
          {rssNews.length > 0 && (
            <div className="mt-6">
              <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2 tracking-tight">
                <Newspaper className="h-4 w-4 text-primary" />
                실시간 뉴스
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rssNews.map((item, i) => (
                  <article
                    key={i}
                    className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all text-left flex flex-col"
                  >
                    <div className="p-4 flex flex-col gap-3 flex-1 min-w-0">
                      <h3 className="font-medium text-foreground text-[15px] leading-snug line-clamp-2">
                        {item.title || '제목 없음'}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
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
            <div className="mt-6 flex flex-col items-center justify-center min-h-[320px] text-center rounded-xl border border-border bg-card p-8">
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
                    setTabError({ logic: null, creative: null, fact: null })
                    setTabCache((prev) => ({ ...prev, [activeTab]: null }))
                    fetchTabAnalysis(activeTab as AiTabId)
                  }}
                >
                  다시 시도
                </Button>
              </div>
            </div>
          ) : (
          AI_TABS.map(({ id }) => (
            <TabsContent key={id} value={id} className="mt-6">
              {tabError[id] ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <p className="text-destructive text-sm">{tabError[id]}</p>
                  <p className="text-muted-foreground text-xs mt-1">쿼터 부족 또는 일시적인 트래픽 제한일 수 있습니다. 아래 버튼으로 다시 시도해 주세요.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-1.5"
                    onClick={() => {
                      setTabError((prev) => ({ ...prev, [id]: null }))
                      setTabCache((prev) => ({ ...prev, [id]: null }))
                      fetchTabAnalysis(id)
                    }}
                  >
                    다시 시도
                  </Button>
                </div>
              ) : tabLoading[id] ? (
                <div className="flex flex-col items-center justify-center min-h-[320px] text-center">
                  <RinAnimation variant="loading" size={180} className="shrink-0" />
                  <p className="mt-4 text-muted-foreground text-sm">분석 중...</p>
                </div>
              ) : showAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                <RinAnimation variant="loading" size={140} className="shrink-0" />
                <p className="mt-3 text-muted-foreground text-sm">린이 분석하는 중...</p>
              </div>
              ) : tabCache[id] ? (
                <div className={cn('space-y-6', id === 'fact' && 'rounded-xl border border-border bg-white shadow-sm p-8 md:p-10 max-w-4xl mx-auto text-[15px] leading-[1.65]')}>
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        const text = tabCache[id]
                        if (!text) return
                        navigator.clipboard.writeText(text).then(() => toast.success('텍스트가 복사되었어요.'))
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      텍스트 복사
                    </Button>
                  </div>
                  {id === 'logic' && result?.chartData && (
                    <div className="rounded-xl border border-border bg-card p-6">
                      <h3 className="text-sm font-semibold text-foreground mb-3">24시간 검색량·감성 추이</h3>
                      <ResearchCharts chartData={result.chartData} />
                    </div>
                  )}
                  <div className={id === 'fact' ? '' : 'rounded-xl border border-border bg-card p-6'}>
                    <div className={cn('max-w-none text-foreground', id === 'fact' ? 'prose prose-lg leading-relaxed' : 'prose prose-sm')}>
                      <MarkdownWithSearchLinks text={tabCache[id]!} />
                    </div>
                  </div>
                  {id === 'creative' && (
                    <div className="rounded-xl border border-border bg-card p-6">
                      <p className="text-sm font-medium text-foreground mb-3">더 궁금한 점이 있나요?</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="궁금한 점을 입력하세요"
                          value={followUpQuestion}
                          onChange={(e) => setFollowUpQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
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
                              <p className="text-sm text-muted-foreground font-medium">Q. {item.question}</p>
                              <p className="text-foreground whitespace-pre-wrap text-sm">{item.answer}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <TabLoadingPlaceholder />
              )}
            </TabsContent>
          )))}
        </Tabs>

        {/* Section 3. 핵심 요약: 결론 3가지 Badge */}
        {status === 'done' && result && (result.keyConclusions?.length ?? 0) > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
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
          <div className="lg:col-span-4 space-y-4 bg-[#F9FAFB] rounded-xl p-1">
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                실시간 트렌드
              </h3>
              {(sharedTrends.KR.length + sharedTrends.US.length + sharedTrends.JP.length) > 0 ? (
                <>
                  <ul className="space-y-3 mb-3">
                    {([...sharedTrends.KR, ...sharedTrends.US, ...sharedTrends.JP] as TrendItem[]).slice(0, 6).map((item, i) => (
                      <li key={`${item.keyword}-${i}`}>
                        <div className="rounded-lg border border-border bg-[#F9FAFB] p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              href={`/results?keyword=${encodeURIComponent(item.keyword)}`}
                              className="text-sm font-medium text-foreground truncate hover:text-primary"
                            >
                              {item.keyword}
                            </Link>
                            {item.search_volume && (
                              <Badge variant="secondary" className="text-xs shrink-0">{item.search_volume}</Badge>
                            )}
                          </div>
                          {item.started_at && (
                            <p className="text-xs text-muted-foreground mt-1">{item.started_at}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">최근 업데이트: <TimeAgo isoString={sharedTrends.updatedAt} /></p>
                  <Link href="/trends" className="text-xs text-primary hover:underline mt-1 inline-block">전체 보기</Link>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">트렌드 데이터를 불러오는 중이에요.</p>
              )}
            </div>
            {/* 관련 뉴스 피드 */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">관련 뉴스 피드</h3>
              {newsList.length === 0 ? (
                <p className="text-muted-foreground text-xs">뉴스를 불러오는 중이에요.</p>
              ) : (
                <ul className="space-y-2">
                  {newsList.slice(0, 5).map((item, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => { setSelectedNews(item); setSelectedNewsIndex(i) }}
                        className="w-full text-left text-xs font-medium text-foreground hover:text-primary truncate block"
                      >
                        {item.title || '제목 없음'}
                      </button>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                          출처
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {/* 핵심 수치 요약 */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">핵심 수치 요약</h3>
              {result ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">감성 지수</dt>
                    <dd className="font-semibold text-foreground">{result.sentiment ?? 0}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">시장 뉴스</dt>
                    <dd className="font-semibold text-foreground">{result.marketNews?.length ?? 0}건</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">페인포인트</dt>
                    <dd className="font-semibold text-foreground">{result.painPoints?.length ?? 0}건</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-muted-foreground text-xs">분석 완료 후 표시돼요.</p>
              )}
            </div>
            {/* 인용된 출처 리스트 */}
            <div className="rounded-xl border border-border bg-white shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">인용된 출처</h3>
              {newsList.length === 0 ? (
                <p className="text-muted-foreground text-xs">출처가 없어요.</p>
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
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-6">
        <div className="rounded-2xl border border-border bg-white shadow-sm p-8 text-center max-w-md">
          <p className="text-muted-foreground mb-4">검색어가 없습니다.</p>
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
        <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[50vh] gap-6">
          <div className="rounded-2xl border border-border bg-white shadow-sm p-8">
            <RinAnimation variant="loading" size={200} />
            <p className="text-muted-foreground mt-4">{getRandomRinMessage()}</p>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  )
}
