'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface ReportData {
  keyword: string
  marketNews: string[]
  painPoints: string[]
  competitorTrends: string
  sentiment: number
}

export default function ReportDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      setError('리포트 ID가 없습니다.')
      return
    }

    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/${id}`)
        const result = await res.json()

        if (!res.ok) {
          setError(result?.error ?? '리포트를 불러오지 못했습니다.')
          return
        }

        setData({
          keyword: result.keyword,
          marketNews: result.marketNews ?? [],
          painPoints: result.painPoints ?? [],
          competitorTrends: result.competitorTrends ?? '',
          sentiment: result.sentiment ?? 0,
        })
      } catch (err) {
        console.error('리포트 로드 실패:', err)
        setError('리포트를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [id])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive text-center">{error}</p>
        <Link href="/history">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 size-4" />
            히스토리로 돌아가기
          </Button>
        </Link>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">리포트를 불러오는 중...</p>
      </div>
    )
  }

  const { keyword, marketNews, painPoints, competitorTrends, sentiment } = data

  return (
    <main className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-8">
      <header className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold font-serif">
          &quot;{keyword}&quot; 리서치 리포트
        </h1>
        <Badge variant="outline" className="text-sm">Verified by Rin-AI</Badge>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle>🚀 경쟁사 동향</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">
              {competitorTrends || '수집된 경쟁사 동향이 없습니다.'}
            </p>
          </CardContent>
        </Card>

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

      <div className="pt-4 flex gap-2">
        <Link href="/history">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 size-4" />
            히스토리
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            새 검색
          </Button>
        </Link>
      </div>
    </main>
  )
}
