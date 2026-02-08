'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { Button } from '@/components/ui/button'
import { ResearchReportView, type ResearchContent } from '@/components/research-report-view'
import { Loader2, FileDown, Share2 } from 'lucide-react'
import { printReportAsPdf } from '@/lib/pdf-export'

interface ReportApiResponse {
  keyword: string
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: number
}

/** Same UI as /results/[id]; uses shared ResearchReportView (data format = DB content) */
export default function ReportDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [data, setData] = useState<ReportApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleShare = useCallback(async () => {
    if (!id) return
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('공유 링크가 복사되었어요.')
      return
    }
    try {
      const res = await fetch(`/api/reports/${id}/share`, { method: 'POST' })
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
  }, [id, shareUrl])

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
        showErrorToast(err, { fallbackMessage: '리포트를 불러오는 중 오류가 발생했습니다.' })
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
    <div>
      <div className="no-print flex flex-wrap items-center gap-2 mb-4 max-w-6xl mx-auto px-8">
        <Button type="button" variant="outline" size="sm" onClick={printReportAsPdf} className="gap-1.5">
          <FileDown className="w-4 h-4" />
          PDF로 저장
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
          <Share2 className="w-4 h-4" />
          {shareUrl ? '링크 복사' : '공유하기'}
        </Button>
      </div>
      <div className="pdf-source">
        <ResearchReportView
          keyword={data.keyword}
          content={content}
          reportId={null}
          showLoginCta={false}
        />
      </div>
    </div>
  )
}
