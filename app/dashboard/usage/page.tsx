'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Cpu, Globe, Database } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { showErrorToast } from '@/lib/error-toast'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts'

interface UsageData {
  gemini: { used: number; limit: number }
  firecrawl: { used: number; limit: number }
  supabase: { used: number; limit: number }
}

function percentColor(used: number, limit: number): string {
  if (limit <= 0) return '#22c55e'
  const pct = (used / limit) * 100
  if (pct >= 90) return '#ef4444'
  if (pct >= 70) return '#eab308'
  return '#22c55e'
}

function remainingPercent(used: number, limit: number): number {
  if (limit <= 0) return 100
  return Math.max(0, 100 - (used / limit) * 100)
}

export default function UsageDashboardPage() {
  const [data, setData] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/usage')
      .then((res) => res.json())
      .then((d: UsageData) => {
        if (mounted) setData(d)
      })
      .catch((err) => {
        if (mounted) {
          showErrorToast(err, { fallbackMessage: '사용량 정보를 불러오지 못했어요.' })
          setData({
            gemini: { used: 0, limit: 1500 },
            firecrawl: { used: 0, limit: 500 },
            supabase: { used: 0, limit: 50000 },
          })
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const chartData = data
    ? [
        {
          name: 'Gemini',
          used: data.gemini.used,
          limit: data.gemini.limit,
          remaining: Math.max(0, data.gemini.limit - data.gemini.used),
          fill: percentColor(data.gemini.used, data.gemini.limit),
        },
        {
          name: 'Firecrawl',
          used: data.firecrawl.used,
          limit: data.firecrawl.limit,
          remaining: Math.max(0, data.firecrawl.limit - data.firecrawl.used),
          fill: percentColor(data.firecrawl.used, data.firecrawl.limit),
        },
        {
          name: 'Supabase',
          used: data.supabase.used,
          limit: data.supabase.limit,
          remaining: Math.max(0, data.supabase.limit - data.supabase.used),
          fill: percentColor(data.supabase.used, data.supabase.limit),
        },
      ]
    : []

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <RinLogo className="h-8" />
            <h1 className="text-lg font-semibold text-foreground">리소스 관리 대시보드</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm">사용량 불러오는 중...</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground">오늘 / 이번 달 사용량</CardTitle>
                <CardDescription>
                  무료 할당량 대비 사용량입니다. 80% 이상이면 경고 배너가 표시됩니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-1">
                  <div className="rounded-lg border border-border bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Cpu className="h-4 w-4 text-primary" />
                      Gemini (오늘)
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {data.gemini.used.toLocaleString()} / {data.gemini.limit.toLocaleString()}
                      </span>
                      <span
                        className="font-medium"
                        style={{
                          color: percentColor(data.gemini.used, data.gemini.limit),
                        }}
                      >
                        잔여 {remainingPercent(data.gemini.used, data.gemini.limit).toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      className="mt-2 h-2"
                      value={Math.min(100, (data.gemini.used / data.gemini.limit) * 100)}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Globe className="h-4 w-4 text-primary" />
                      Firecrawl (이번 달)
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {data.firecrawl.used.toLocaleString()} /{' '}
                        {data.firecrawl.limit.toLocaleString()}
                      </span>
                      <span
                        className="font-medium"
                        style={{
                          color: percentColor(data.firecrawl.used, data.firecrawl.limit),
                        }}
                      >
                        잔여{' '}
                        {remainingPercent(data.firecrawl.used, data.firecrawl.limit).toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      className="mt-2 h-2"
                      value={Math.min(100, (data.firecrawl.used / data.firecrawl.limit) * 100)}
                    />
                  </div>

                  <div className="rounded-lg border border-border bg-white p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Database className="h-4 w-4 text-primary" />
                      Supabase (리포트 행 수)
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {data.supabase.used.toLocaleString()} /{' '}
                        {data.supabase.limit.toLocaleString()}
                      </span>
                      <span
                        className="font-medium"
                        style={{
                          color: percentColor(data.supabase.used, data.supabase.limit),
                        }}
                      >
                        잔여{' '}
                        {remainingPercent(data.supabase.used, data.supabase.limit).toFixed(0)}%
                      </span>
                    </div>
                    <Progress
                      className="mt-2 h-2"
                      value={Math.min(100, (data.supabase.used / data.supabase.limit) * 100)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-foreground">잔여량 비교</CardTitle>
                <CardDescription>서비스별 남은 할당량 (도넛 개념: 사용량 vs 잔여)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 24 }}>
                      <XAxis type="number" domain={[0, 'auto']} />
                      <YAxis type="category" dataKey="name" width={56} />
                      <Tooltip
                        formatter={(value: number, name: string, props: { payload: (typeof chartData)[0] }) =>
                          [`${value.toLocaleString()} (잔여)`, props.payload.name]
                        }
                      />
                      <Bar dataKey="remaining" name="잔여" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>
    </div>
  )
}
