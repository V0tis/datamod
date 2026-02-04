'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResearchReportView, type ResearchContent } from '@/components/research-report-view'

interface ResearchResponse extends ResearchContent {
  reportId?: string | null
  error?: string
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword')
  const [data, setData] = useState<ResearchResponse | null>(null)
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
        const result: ResearchResponse = await response.json()

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

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive">{error}</p>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            검색으로 돌아가기
          </Button>
        </Link>
      </div>
    )
  }

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

  if (!data) return null

  return (
    <ResearchReportView
      keyword={keyword ?? ''}
      content={data}
      reportId={data.reportId ?? null}
      showLoginCta={!data.reportId}
      loginCallbackUrl={`/results?keyword=${encodeURIComponent(keyword ?? '')}`}
    />
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
