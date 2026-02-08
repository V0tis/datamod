import { NextResponse } from 'next/server'
import { refreshGlobalTrends } from '@/lib/trends-cache'

/** POST: 공유 캐시 수동 갱신 (Firecrawl 크롤링 후 global_trends에 저장) */
export async function POST() {
  if (!process.env.FIRECRAWL_API_KEY?.trim()) {
    return NextResponse.json(
      { error: 'FIRECRAWL_API_KEY가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }
  const updated = await refreshGlobalTrends()
  return NextResponse.json({ success: true, updated })
}
