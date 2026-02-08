'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Trash2, FileText, Loader2, History } from 'lucide-react'

interface ResearchReport {
  id: string
  keyword: string
  date: string
  sentiment: number
  summary: string
}

export default function HistoryPage() {
  const [reports, setReports] = useState<ResearchReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const syncReportsFromDb = useCallback(async () => {
    try {
      const res = await fetch('/api/reports')
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      setReports(data.reports ?? [])
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    syncReportsFromDb()
  }, [syncReportsFromDb])

  useEffect(() => {
    const onVisible = () => syncReportsFromDb()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }
  }, [syncReportsFromDb])

  const handleDelete = async (id: string) => {
    if (!confirm('이 리포트를 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
      if (res.ok) setReports((prev) => prev.filter((r) => r.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="space-y-2 mb-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted rounded animate-pulse" />
        </div>
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 p-6 animate-pulse">
                <div className="h-6 w-32 bg-muted rounded mb-2" />
                <div className="h-4 w-full max-w-md bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center gap-4 min-h-[40vh]">
        <Card className="border border-border bg-white shadow-sm max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Card className="border border-border bg-white shadow-sm max-w-md w-full">
          <CardContent className="p-10 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              린이 아직 소식을 물어오지 않았어요!
            </h2>
            <p className="text-muted-foreground text-sm mb-6">
              검색하면 분석 결과가 여기에 쌓여요.
            </p>
            <Link href="/">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <Search className="w-4 h-4" />
                메인 검색창으로 이동
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          내 리서치 기록
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          린(Rin)이 과거에 물어온 리서치 리포트를 확인해보세요.
        </p>
      </header>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card
            key={report.id}
            className="border border-border bg-white shadow-sm hover:shadow-md transition-shadow"
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <Link
                  href={`/results/${report.id}`}
                  className="flex-1 space-y-3 min-w-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">{report.keyword}</h3>
                      <Badge variant="outline" className="text-xs bg-muted/50">
                        {report.date}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {report.summary}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">긍정도:</span>
                    <span className="text-sm font-bold text-primary">{report.sentiment}%</span>
                  </div>
                </Link>
                <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                  <Link href={`/results/${report.id}`}>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 gap-2 w-full sm:w-auto">
                      <FileText className="w-4 h-4" />
                      상세 보기
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault()
                      handleDelete(report.id)
                    }}
                    disabled={deletingId === report.id}
                    className="gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                  >
                    {deletingId === report.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    삭제
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        총 <span className="font-semibold text-foreground">{reports.length}</span>개의 리서치 리포트
      </p>
    </div>
  )
}
