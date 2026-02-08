'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, TrendingUp, MessageSquare, Eye, BarChart3 } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { showErrorToast } from '@/lib/error-toast'

// TODO: API 응답 타입으로 교체
interface DashboardData {
  newsData: { title: string; source: string; timeAgo: string; snippet: string }[]
  painPoints: { quote: string; platform: string; upvotes: number }[]
  competitors: { brand: string; activity: string; impact: string }[]
  sentiment: { positive: number; negative: number; keywords: string[]; mentions: number }
}

const MOCK_DATA: DashboardData = {
  newsData: [
    { title: '전기차 시장 규모 2024년 급성장 전망', source: '테크뉴스', timeAgo: '2h ago', snippet: '업계 전문가들은 올해 전기차 시장이 전년 대비 40% 성장할 것으로...' },
    { title: '배터리 기술 혁신으로 주행거리 2배 증가', source: '모빌리티 투데이', timeAgo: '5h ago', snippet: '신규 고체 배터리 기술이 상용화 단계에 진입하면서...' },
    { title: '충전 인프라 확대, 정부 지원 정책 발표', source: '경제신문', timeAgo: '8h ago', snippet: '정부가 2025년까지 전국에 10만개의 충전소를 설치하기로...' },
  ],
  painPoints: [
    { quote: '"충전 시간이 너무 오래 걸려서 장거리 여행이 불편해요"', platform: 'Reddit', upvotes: 342 },
    { quote: '"가격이 아직도 비싸서 구매를 망설이게 돼요"', platform: 'Twitter', upvotes: 187 },
    { quote: '"겨울에 주행거리가 30% 이상 떨어져요"', platform: 'Community', upvotes: 256 },
    { quote: '"중고차 가격이 급락해서 재판매 가치가 걱정돼요"', platform: 'Forum', upvotes: 412 },
  ],
  competitors: [
    { brand: 'Tesla', activity: '새로운 모델 Y 변형 출시 예정, 가격 인하 전략 진행 중', impact: 'High' },
    { brand: 'Hyundai', activity: '아이오닉 라인업 확장, 구독 서비스 베타 테스트', impact: 'Medium' },
    { brand: 'BYD', activity: '한국 시장 진출 가속화, 공격적 가격 정책', impact: 'High' },
  ],
  sentiment: {
    positive: 68,
    negative: 32,
    keywords: ['친환경', '혁신', '비용 부담', '충전 인프라', '주행거리', '유지비'],
    mentions: 2847,
  },
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword') || '검색어'

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchDashboardData() {
      try {
        // TODO: 백엔드 API 연동 시 아래 주석 해제 후 MOCK_DATA 대체
        // const res = await fetch(`/api/dashboard?keyword=${encodeURIComponent(keyword)}`)
        // if (!res.ok) throw new Error('데이터를 불러오는데 실패했습니다.')
        // const json = await res.json()
        // if (mounted) setData(json)

        // 현재: 더미 데이터 사용
        await new Promise((r) => setTimeout(r, 300)) // 로딩 시뮬레이션
        if (mounted) setData(MOCK_DATA)
      } catch (err) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
          showErrorToast(err, { fallbackMessage: msg })
          setError(msg)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchDashboardData()
    return () => {
      mounted = false
    }
  }, [keyword])

  const currentTime = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">대시보드 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive">{error ?? '데이터를 불러올 수 없습니다.'}</p>
        <Button variant="outline" onClick={() => (window.location.href = '/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          검색으로 돌아가기
        </Button>
      </div>
    )
  }

  const { newsData, painPoints, competitors, sentiment } = data

  return (
    <div className="min-h-screen bg-background">
      {/* Header - keyword 파라미터를 상단 타이틀에 표시 */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <RinLogo size={28} />
              <h1 className="text-xl font-bold text-foreground">Rin-AI</h1>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">검색 키워드</span>
              <h2 className="text-lg font-semibold text-foreground">
                &quot;{keyword}&quot;
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/usage" className="gap-1.5 text-muted-foreground hover:text-foreground">
                리소스 사용량
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = '/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              새로운 검색
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market News Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">시장 뉴스</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {newsData.map((news, index) => (
                <div key={index} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-relaxed text-foreground">
                      {news.title}
                    </h3>
                    <Badge variant="outline" className="text-xs shrink-0 bg-primary/10 text-primary border-primary/20">
                      {news.timeAgo}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{news.snippet}</p>
                  <p className="text-xs text-muted-foreground">출처: {news.source}</p>
                </div>
              ))}
            </CardContent>
            <CardFooter className="bg-muted/30 text-xs text-muted-foreground border-t border-border">
              Verified by Rin-AI at {currentTime}
            </CardFooter>
          </Card>

          {/* User Pain Points Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">유저 Pain Points</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {painPoints.map((point, index) => (
                <div key={index} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                  <p className="text-sm leading-relaxed text-foreground italic">{point.quote}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{point.platform}</span>
                    <span>•</span>
                    <span className="text-primary font-medium">↑ {point.upvotes} upvotes</span>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="bg-muted/30 text-xs text-muted-foreground border-t border-border">
              Verified by Rin-AI at {currentTime}
            </CardFooter>
          </Card>

          {/* Competitor Watch Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">경쟁사 동향</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {competitors.map((competitor, index) => (
                <div key={index} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-foreground">{competitor.brand}</h3>
                    <Badge
                      variant={competitor.impact === 'High' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {competitor.impact} Impact
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {competitor.activity}
                  </p>
                </div>
              ))}
            </CardContent>
            <CardFooter className="bg-muted/30 text-xs text-muted-foreground border-t border-border">
              Verified by Rin-AI at {currentTime}
            </CardFooter>
          </Card>

          {/* Sentiment Analysis Card */}
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">감성 분석</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">긍정적 반응</span>
                  <span className="text-primary font-bold">{sentiment.positive}%</span>
                </div>
                <Progress value={sentiment.positive} className="h-3" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">부정적 반응</span>
                  <span className="text-destructive font-bold">{sentiment.negative}%</span>
                </div>
                <Progress value={sentiment.negative} className="h-3 [&>div]:bg-destructive" />
              </div>
              <div className="pt-4 border-t border-border space-y-3">
                <h4 className="text-sm font-semibold text-foreground">주요 키워드</h4>
                <div className="flex flex-wrap gap-2">
                  {sentiment.keywords.map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">분석된 데이터</span>
                  <span className="font-semibold text-foreground">
                    {sentiment.mentions.toLocaleString()} mentions
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 text-xs text-muted-foreground border-t border-border">
              Verified by Rin-AI at {currentTime}
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
