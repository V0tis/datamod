'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Trash2, FileText, Loader2 } from 'lucide-react'

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

  useEffect(() => {
    const fetchReports = async () => {
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
    }
    fetchReports()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('이 리포트를 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id))
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground">히스토리를 불러오는 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()} className="rounded-full">
          다시 시도
        </Button>
      </div>
    )
  }

  // 빈 화면: Rin 스타일 문구 + 검색 연결 버튼
  if (reports.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐕</span>
              <h1 className="text-xl font-bold text-foreground">Rin-AI</h1>
            </div>
            <Link href="/">
              <Button className="gap-2 rounded-full bg-primary hover:bg-primary/90">
                <Search className="w-4 h-4" />
                새로운 검색
              </Button>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="max-w-md text-center space-y-6">
            <div className="text-8xl">🐕</div>
            <p className="text-lg text-foreground leading-relaxed">
              린이 아직 소식을 물어오지 않았어요!
            </p>
            <Link href="/">
              <Button
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90 gap-2 mt-4"
              >
                <Search className="w-5 h-5" />
                메인 검색창으로 이동
              </Button>
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐕</span>
            <h1 className="text-xl font-bold text-foreground">Rin-AI</h1>
          </div>
          <Link href="/">
            <Button className="gap-2 rounded-full bg-primary hover:bg-primary/90">
              <Search className="w-4 h-4" />
              새로운 검색
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">리서치 히스토리</h2>
            <p className="text-muted-foreground">
              린(Rin)이 과거에 물어온 리서치 리포트를 확인해보세요
            </p>
          </div>

          <div className="space-y-4">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="shadow-sm hover:shadow-md transition-all duration-200 border border-border"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-foreground">
                            {report.keyword}
                          </h3>
                          <Badge variant="outline" className="text-xs bg-muted">
                            {report.date}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {report.summary}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🌡️</span>
                        <span className="text-sm font-medium text-foreground">긍정도:</span>
                        <span className="text-sm font-bold text-primary">
                          {report.sentiment}%
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <Link href={`/reports/${report.id}`}>
                        <Button
                          size="sm"
                          className="rounded-full bg-primary hover:bg-primary/90 gap-2 w-full"
                        >
                          <FileText className="w-4 h-4" />
                          상세 보기
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(report.id)}
                        disabled={deletingId === report.id}
                        className="rounded-full gap-2 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
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

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              총 <span className="font-semibold text-foreground">{reports.length}</span>개의 리서치 리포트
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
