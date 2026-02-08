'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useResearchStore } from '@/lib/stores/research-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const TREND_MOCK: Record<'KR' | 'US' | 'JP', string[]> = {
  KR: ['명일방주 최신트렌드', '전기차 시장', 'AI 챗봇', '배터리 기술', '메타버스'],
  US: ['AI regulation', 'Electric vehicles', 'Crypto market', 'Cloud computing', 'Climate tech'],
  JP: ['AIトレンド', 'EV市場', '半導体', 'ゲーム業界', 'DX推進'],
}

const COUNTRY_LABELS: Record<'KR' | 'US' | 'JP', string> = {
  KR: '한국',
  US: '미국',
  JP: '일본',
}

export default function TrendsPage() {
  const router = useRouter()
  const startResearch = useResearchStore((s) => s.startResearch)
  const [country, setCountry] = useState<'KR' | 'US' | 'JP'>('KR')

  const handleKeywordClick = (keyword: string) => {
    startResearch(keyword)
    router.push(`/results?keyword=${encodeURIComponent(keyword)}`)
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          국가별 트렌드
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          국가별 인기 검색어를 클릭하면 바로 분석 결과를 볼 수 있어요.
        </p>
      </header>

      <Card className="border border-border bg-white shadow-sm">
        <div className="p-4 border-b border-border flex gap-2 flex-wrap">
          {(['KR', 'US', 'JP'] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCountry(code)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                country === code
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              {COUNTRY_LABELS[code]} ({code})
            </button>
          ))}
        </div>
        <CardHeader>
          <CardTitle className="text-lg">{COUNTRY_LABELS[country]} 인기 검색어</CardTitle>
          <CardDescription>클릭 시 해당 키워드로 분석이 시작돼요.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {TREND_MOCK[country].map((keyword, i) => (
              <li key={keyword}>
                <button
                  type="button"
                  onClick={() => handleKeywordClick(keyword)}
                  className="w-full text-left rounded-xl border border-border bg-muted/30 px-4 py-3.5 hover:bg-primary/5 hover:border-primary/30 transition-all flex items-center gap-3"
                >
                  <span className="text-muted-foreground text-sm font-medium w-6">{i + 1}</span>
                  <span className="text-foreground font-medium flex-1 truncate">{keyword}</span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
