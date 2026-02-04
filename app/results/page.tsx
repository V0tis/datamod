'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface ResearchData {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: number
  error?: string
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword')
  const [data, setData] = useState<ResearchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!keyword) {
      setLoading(false)
      setError('검색어가 없습니다.')
      return
    }

    const fetchData = async () => {
      try {
        const response = await fetch('/api/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword }),
        })
        const result: ResearchData = await response.json()

        if (!response.ok) {
          setError(result?.error ?? '분석에 실패했습니다.')
          return
        }

        setData(result)
      } catch (err) {
        console.error('데이터 수집 실패:', err)
        setError('데이터를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [keyword])

  // 검색어 없음 / API 오류
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive">{error}</p>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 size-4" />
            검색으로 돌아가기
          </Button>
        </Link>
      </div>
    )
  }

  // 1. 수집 중 UI (Loading State)
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-6 bg-background">
        <div className="text-8xl animate-bounce">🐕</div>
        <h2 className="text-2xl font-bold text-center px-4">
          린(Rin)이 &apos;{keyword}&apos;에 대해 냄새를 맡고 있습니다...
        </h2>
        <p className="text-muted-foreground">최신 뉴스 및 커뮤니티 반응을 분석 중입니다.</p>
      </div>
    )
  }

  // 2. 분석 결과 대시보드 UI
  const marketNews = data?.marketNews ?? []
  const painPoints = data?.painPoints ?? []
  const competitorTrends = data?.competitorTrends ?? ''
  const sentiment = data?.sentiment ?? 0

  return (
    <main className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold font-serif">
          &quot;{keyword}&quot; 리서치 리포트
        </h1>
        <Badge variant="outline" className="text-sm">Verified by Rin-AI</Badge>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 시장 뉴스 요약 */}
        <Card>
          <CardHeader>
            <CardTitle>📰 시장 뉴스 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2">
              {marketNews.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {marketNews.length === 0 && (
                <li className="text-muted-foreground">수집된 뉴스가 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* 페인 포인트 */}
        <Card>
          <CardHeader>
            <CardTitle>😫 유저 페인 포인트</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-red-600 dark:text-red-400">
              {painPoints.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {painPoints.length === 0 && (
                <li className="text-muted-foreground">수집된 페인 포인트가 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* 경쟁사 동향 */}
        <Card>
          <CardHeader>
            <CardTitle>🚀 경쟁사 동향</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{competitorTrends || '수집된 경쟁사 동향이 없습니다.'}</p>
          </CardContent>
        </Card>

        {/* 유저 반응 온도 */}
        <Card>
          <CardHeader>
            <CardTitle>🌡️ 유저 반응 (긍정 점수)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-yellow-500">{sentiment}%</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-4 rounded-full mt-4 overflow-hidden">
              <div
                className="bg-yellow-500 h-4 rounded-full transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.max(0, sentiment))}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pt-4">
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 size-4" />
            새 검색
          </Button>
        </Link>
      </div>
    </main>
  )
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-8xl animate-bounce">🐕</div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  )
}
