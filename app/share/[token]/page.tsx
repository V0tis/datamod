'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { ResearchReportView, type ResearchContent } from '@/components/research-report-view'

interface SharedReportResponse {
  keyword: string
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: number
  publicReactionTrends?: string
}

export default function SharedReportPage() {
  const params = useParams()
  const token = params?.token as string
  const [data, setData] = useState<SharedReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('공유 링크가 올바르지 않습니다.')
      return
    }

    const fetchShared = async () => {
      try {
        const res = await fetch(`/api/share/${token}`)
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
          publicReactionTrends: result.publicReactionTrends ?? '',
        })
      } catch {
        setError('리포트를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchShared()
  }, [token])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <ErrorState
          title="공유 리포트를 불러오지 못했습니다"
          description="링크가 만료되었거나 잘못되었을 수 있습니다. 공유해 주신 분에게 새 링크를 요청해 보세요."
          recoveryLabel="홈으로"
          onRecovery={() => { window.location.href = '/' }}
          detail={error}
        />
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <LoadingState
          message="공유된 리포트를 불러오는 중입니다"
          detail="잠시만 기다려 주세요."
          size="lg"
        />
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
    <div className="pb-8">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <p className="text-sm text-muted-foreground mb-2">공유된 리포트</p>
        <Link href="/">
          <Button variant="outline" size="sm">Rin-AI 홈으로</Button>
        </Link>
      </div>
      <ResearchReportView
        keyword={data.keyword}
        content={content}
        reportId={null}
        showLoginCta={false}
        embedded={false}
      />
    </div>
  )
}
