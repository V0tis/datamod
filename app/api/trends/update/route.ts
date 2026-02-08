import { NextResponse } from 'next/server'
import { refreshGlobalTrends } from '@/lib/trends-cache'

const JSON_HEADERS = { 'Content-Type': 'application/json' } as const
const isDev = process.env.NODE_ENV === 'development'

/** POST: 공유 캐시 수동 갱신 (Firecrawl 크롤링 후 global_trends에 저장) */
export async function POST() {
  try {
    if (!process.env.FIRECRAWL_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY가 설정되지 않았습니다.' },
        { status: 500, headers: JSON_HEADERS }
      )
    }
    const { KR, US, JP } = await refreshGlobalTrends()

    return NextResponse.json({ success: true, updated: { KR, US, JP } }, { headers: JSON_HEADERS })
  } catch (err) {
    if (isDev) console.log('[Dev] Trends update exception:', err, err instanceof Error ? err.stack : '')
    console.error('[Trends update]', err)
    const payload: { error: string; message?: string } = { error: '트렌드 갱신 중 오류가 발생했습니다.' }
    if (isDev && err) {
      payload.message = err instanceof Error ? err.message : String(err)
    }
    return NextResponse.json(payload, { status: 500, headers: JSON_HEADERS })
  }
}
