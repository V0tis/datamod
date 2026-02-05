'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResearchReportView, type ResearchContent } from '@/components/research-report-view'
import { Loader2 } from 'lucide-react'

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive text-center">{error}</p>
        <Link href="/">
          <Button variant="outline">홈으로</Button>
        </Link>
      </div>
    )
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">공유된 리포트를 불러오는 중...</p>
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
