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
import { FileDown, Share2, X, ExternalLink, TrendingUp } from 'lucide-react'
import { formatTimeAgo } from '@/lib/utils'
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
    insights: storeInsights,
    setInsights: setStoreInsights,
    startResearch,
  } = useResearchStore()

  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('report')
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [followUps, setFollowUps] = useState<Array<{ question: string; answer: string }>>([])
  const [followUpQuestion, setFollowUpQuestion] = useState('')
  const [followUpLoading, setFollowUpLoading] = useState(false)
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null)
  const [selectedNewsIndex, setSelectedNewsIndex] = useState<number | null>(null)
  const [sharedTrends, setSharedTrends] = useState<TrendsResponse>({
    KR: [], US: [], JP: [], updatedAt: null,
  })
  const scheduledInsightsForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!keyword) return
    startResearch(keyword)
  }, [keyword, startResearch])

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
    if (status === 'loading') scheduledInsightsForRef.current = null
  }, [status])

  const loading = status === 'loading'
  const currentKeyword = keyword ?? storeKeyword

  const fetchInsights = useCallback(async () => {
    if (storeInsights !== null || insightsLoading) return
    setInsightsLoading(true)
    setInsightsError(null)
    try {
      const reportSummary = result
        ? [
            result.marketNews?.length ? `시장 뉴스 요약: ${result.marketNews.join(' ')}` : '',
            result.painPoints?.length ? `유저 페인포인트: ${result.painPoints.join(' ')}` : '',
            result.competitorTrends ? `경쟁사 동향: ${result.competitorTrends}` : '',
          ]
            .filter(Boolean)
            .join('\n\n')
        : ''
      const res = await fetch('/api/research/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: currentKeyword, summary: reportSummary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showErrorToast(data, { fallbackMessage: '분석을 불러오지 못했어요.' })
        setInsightsError((data as { error?: string }).error ?? '분석을 불러오지 못했어요.')
        setStoreInsights(null)
        return
      }
      const text = typeof (data as { insights?: string }).insights === 'string'
        ? (data as { insights: string }).insights
        : '분석 결과가 없어요.'
      setStoreInsights(text)
    } catch (err) {
      showErrorToast(err, { fallbackMessage: '유저 반응 분석 중 오류가 발생했어요.' })
      setInsightsError('유저 반응 분석 중 오류가 발생했어요.')
      setStoreInsights(null)
    } finally {
      setInsightsLoading(false)
    }
  }, [currentKeyword, result, storeInsights, insightsLoading, setStoreInsights])

  useEffect(() => {
    if (
      status !== 'done' ||
      !result ||
      result.publicReactionTrends ||
      storeInsights !== null ||
      insightsLoading ||
      !currentKeyword ||
      scheduledInsightsForRef.current === currentKeyword
    ) {
      return
    }
    scheduledInsightsForRef.current = currentKeyword
    const delayMs = 1000 + Math.random() * 1000
    const t = setTimeout(() => {
      toast.info('리포트 분석 완료! 이제 유저 반응을 예측하고 있어요...')
      fetchInsights()
    }, delayMs)
    return () => clearTimeout(t)
  }, [status, result, currentKeyword, storeInsights, insightsLoading, fetchInsights])

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
    const previousInsights = result?.publicReactionTrends ?? storeInsights ?? ''
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
  }, [followUpQuestion, followUpLoading, currentKeyword, result?.publicReactionTrends, storeInsights])

  const showTabs = !!currentKeyword
  if (showTabs) {
    return (
      <div className="p-6 md:p-8 min-h-screen bg-[#F9FAFB]">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main: col-span-8 */}
          <div className="lg:col-span-8 space-y-6">
        <div className="rounded-xl border border-border bg-white shadow-sm p-6 md:p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            &quot;{currentKeyword}&quot; 검색 결과
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading
              ? '린이 가져온 뉴스예요. 다른 페이지로 이동해도 분석은 계속돼요.'
              : '탭을 전환해 관련 뉴스, 데이터 분석, 유저 반응, 리포트 요약을 확인하세요.'}
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-destructive text-sm text-center sm:text-left flex-1">{error}</p>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  startResearch(currentKeyword ?? '')
                }}
              >
                다시 시도
              </Button>
              <Link href="/">
                <Button variant="outline" size="sm">검색으로 돌아가기</Button>
              </Link>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="report">리포트</TabsTrigger>
            <TabsTrigger value="charts">데이터 분석</TabsTrigger>
            <TabsTrigger value="insights">유저 반응</TabsTrigger>
            <TabsTrigger value="news">뉴스</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="mt-6">
            {loading && newsList.length > 0 ? (
              <ReportSkeleton />
            ) : status === 'done' && result ? (
              <div>
                <div className="no-print flex flex-wrap items-center gap-2 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={printReportAsPdf}
                    className="gap-1.5"
                  >
                    <FileDown className="w-4 h-4" />
                    PDF로 저장
                  </Button>
                  {result.reportId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                      className="gap-1.5"
                    >
                      <Share2 className="w-4 h-4" />
                      {shareUrl ? '링크 복사' : '공유하기'}
                    </Button>
                  )}
                </div>
                <div className="pdf-source">
                  <ResearchReportView
                    keyword={currentKeyword}
                    content={result}
                    reportId={result.reportId ?? null}
                    showLoginCta={!result.reportId}
                    loginCallbackUrl={`/results?keyword=${encodeURIComponent(currentKeyword)}`}
                    embedded
                  />
                </div>
              </div>
            ) : (
              <TabLoadingPlaceholder />
            )}
          </TabsContent>

          <TabsContent value="news" className="mt-6">
            {loading && newsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[280px] text-center">
                <RinAnimation variant="loading" size={180} className="shrink-0" />
                <p className="mt-4 text-muted-foreground text-sm">뉴스를 찾는 중...</p>
              </div>
            ) : (
            <ul className="space-y-3">
              {newsList.length === 0 ? (
                <li className="text-muted-foreground text-sm py-8 text-center">
                  수집된 뉴스가 없어요.
                </li>
              ) : (
                newsList.map((item, i) => (
                  <li key={i}>
                    <div className="rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedNews(item)
                          setSelectedNewsIndex(i)
                        }}
                        className="flex-1 text-left min-w-0"
                      >
                        <span className="font-medium text-foreground block">
                          {item.title || '제목 없음'}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-1 truncate">
                          {item.url || '링크 없음'}
                        </span>
                        <span className="block text-xs text-primary mt-1">클릭하면 본문 · AI 요약 보기</span>
                      </button>
                      {item.url && (
                        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" asChild>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            원문 링크 가기
                          </a>
                        </Button>
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
            )}
          </TabsContent>

          <TabsContent value="charts" className="mt-6">
            {loading && newsList.length > 0 ? (
              <ChartSkeleton />
            ) : status === 'done' && result?.chartData ? (
              <ResearchCharts chartData={result.chartData} />
            ) : (
              <TabLoadingPlaceholder />
            )}
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            {(result?.publicReactionTrends ?? storeInsights) != null ? (
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                  <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                    {result?.publicReactionTrends ?? storeInsights}
                  </div>
                </div>
                {followUps.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground">추가 Q&amp;A</h3>
                    {followUps.map((item, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                        <p className="text-sm text-muted-foreground font-medium">Q. {item.question}</p>
                        <p className="text-foreground whitespace-pre-wrap text-sm">{item.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="rounded-xl border border-border bg-card p-6">
                  <p className="text-sm font-medium text-foreground mb-3">
                    이 반응들에 대해 더 궁금한 점이 있나요?
                  </p>
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
                </div>
              </div>
            ) : insightsError ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <p className="text-destructive text-sm">{insightsError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setInsightsError(null)
                    setStoreInsights(null)
                    setInsightsLoading(false)
                  }}
                >
                  다시 시도
                </Button>
              </div>
            ) : (
              <TabLoadingPlaceholder />
            )}
          </TabsContent>
        </Tabs>
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
                          {item.analysis_keywords?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.analysis_keywords.slice(0, 4).map((kw, j) => (
                                <Link key={j} href={`/results?keyword=${encodeURIComponent(kw)}`}>
                                  <Badge variant="outline" className="text-xs font-normal cursor-pointer hover:bg-primary/10">
                                    {kw}
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">최근 업데이트: {formatTimeAgo(sharedTrends.updatedAt)}</p>
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
