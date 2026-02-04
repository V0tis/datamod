'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResearchReportView, type ResearchContent } from '@/components/research-report-view'
import { Loader2 } from 'lucide-react'

/**
 * 동적 라우팅 /results/[id]: URL의 리포트 ID로 DB에서 데이터를 불러와 분석 결과 표시.
 * 히스토리에서 항목 클릭 시 이 페이지로 이동. Supabase Auth 세션으로 본인 데이터만 조회.
 */
interface ReportApiResponse {
  keyword: string
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: number
}

export default function ResultDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<ReportApiResponse | null>(null)
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
        const result: ReportApiResponse & { error?: string } = await res.json()

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

  const content: ResearchContent = {
    marketNews: data.marketNews ?? [],
    painPoints: data.painPoints ?? [],
    competitorTrends: data.competitorTrends ?? '',
    sentiment: data.sentiment ?? 0,
  }

  return (
    <ResearchReportView
      keyword={data.keyword}
      content={content}
      reportId={null}
      showLoginCta={false}
    />
  )
}
