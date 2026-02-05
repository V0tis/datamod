'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ResearchReportView } from '@/components/research-report-view'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useResearchStore } from '@/lib/stores/research-store'

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

  useEffect(() => {
    if (!keyword) return
    startResearch(keyword)
  }, [keyword, startResearch])

  const loading = status === 'loading'
  const currentKeyword = keyword ?? storeKeyword

  const fetchInsights = useCallback(async () => {
    if (storeInsights !== null || insightsLoading) return
    setInsightsLoading(true)
    setInsightsError(null)
    toast.info('유저 반응 예측 중...')
    try {
      const summary = result
        ? [
            result.marketNews?.join(' '),
            result.painPoints?.join(' '),
            result.competitorTrends,
          ]
            .filter(Boolean)
            .join('\n')
        : ''
      const res = await fetch('/api/research/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: currentKeyword, summary }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setInsightsError((data as { error?: string }).error ?? '분석을 불러오지 못했어요.')
        setStoreInsights(null)
        return
      }
      const text = typeof (data as { insights?: string }).insights === 'string'
        ? (data as { insights: string }).insights
        : '분석 결과가 없어요.'
      setStoreInsights(text)
    } catch {
      setInsightsError('유저 반응 분석 중 오류가 발생했어요.')
      setStoreInsights(null)
    } finally {
      setInsightsLoading(false)
    }
  }, [currentKeyword, result, storeInsights, insightsLoading, setStoreInsights])

  useEffect(() => {
    if (
      activeTab === 'insights' &&
      !result?.publicReactionTrends &&
      storeInsights === null &&
      !insightsLoading &&
      !insightsError
    ) {
      fetchInsights()
    }
  }, [activeTab, storeInsights, insightsLoading, insightsError, result?.publicReactionTrends, fetchInsights])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive text-center">{error}</p>
        <Link href="/">
          <Button variant="outline">검색으로 돌아가기</Button>
        </Link>
      </div>
    )
  }

  if (loading && newsList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-8 bg-background px-4">
        <RinAnimation variant="loading" size={280} className="shrink-0" />
        <div className="text-center space-y-2">
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">
            린이 뉴스를 물어오고 있어요...
          </h2>
          <p className="text-muted-foreground text-sm">잠시만 기다려 주세요.</p>
        </div>
      </div>
    )
  }

  const showTabs = loading ? newsList.length > 0 : true
  if (showTabs) {
    return (
      <div className="min-h-screen bg-background p-6 md:p-8 max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            &quot;{currentKeyword}&quot; 검색 결과
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading
              ? '린이 가져온 뉴스예요. 다른 페이지로 이동해도 분석은 계속돼요.'
              : '탭을 전환해 리포트 요약, 관련 뉴스, 유저 반응을 확인하세요.'}
          </p>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="report">리포트 요약</TabsTrigger>
            <TabsTrigger value="news">관련 뉴스</TabsTrigger>
            <TabsTrigger value="insights">유저 반응</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="mt-6">
            {loading && newsList.length > 0 ? (
              <ReportSkeleton />
            ) : status === 'done' && result ? (
              <ResearchReportView
                keyword={currentKeyword}
                content={result}
                reportId={result.reportId ?? null}
                showLoginCta={!result.reportId}
                loginCallbackUrl={`/results?keyword=${encodeURIComponent(currentKeyword)}`}
                embedded
              />
            ) : (
              <TabLoadingPlaceholder />
            )}
          </TabsContent>

          <TabsContent value="news" className="mt-6">
            <ul className="space-y-3">
              {newsList.length === 0 ? (
                <li className="text-muted-foreground text-sm py-8 text-center">
                  수집된 뉴스가 없어요.
                </li>
              ) : (
                newsList.map((item, i) => (
                  <li key={i}>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium text-foreground">
                          {item.title || '제목 없음'}
                        </span>
                        <span className="block text-xs text-muted-foreground mt-1 truncate">
                          {item.url}
                        </span>
                      </a>
                    ) : (
                      <div className="rounded-xl border border-border bg-card p-4">
                        <span className="font-medium text-foreground">
                          {item.title || '제목 없음'}
                        </span>
                      </div>
                    )}
                  </li>
                ))
              )}
            </ul>
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            {(result?.publicReactionTrends ?? storeInsights) != null ? (
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">
                  {result?.publicReactionTrends ?? storeInsights}
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
      </div>
    )
  }

  if (!keyword) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-muted-foreground">검색어가 없습니다.</p>
        <Link href="/">
          <Button variant="outline">검색으로 돌아가기</Button>
        </Link>
      </div>
    )
  }

  return null
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
          <RinAnimation variant="loading" size={240} />
          <p className="text-muted-foreground">{getRandomRinMessage()}</p>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  )
}
