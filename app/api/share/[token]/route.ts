import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json(
        { error: '공유 링크가 올바르지 않습니다.' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const { data: report, error } = await supabase
      .from('reports')
      .select('id, keyword, content, source_links, created_at')
      .eq('share_token', token)
      .single()

    if (error || !report) {
      return NextResponse.json(
        { error: '공유된 리포트를 찾을 수 없거나 만료되었습니다.' },
        { status: 404 }
      )
    }

    const c = report.content as {
      marketNews?: string[]
      painPoints?: string[]
      competitorTrends?: string
      sentiment?: number
      publicReactionTrends?: string
    }
    const sourceLinks = Array.isArray((report as { source_links?: unknown }).source_links)
      ? (report as { source_links: Array<{ title?: string; url?: string }> }).source_links
      : []

    return NextResponse.json({
      id: report.id,
      keyword: report.keyword,
      created_at: report.created_at,
      marketNews: c?.marketNews ?? [],
      painPoints: c?.painPoints ?? [],
      competitorTrends: c?.competitorTrends ?? '',
      sentiment: typeof c?.sentiment === 'number' ? c.sentiment : 0,
      publicReactionTrends: c?.publicReactionTrends ?? '',
      source_links: sourceLinks,
    })
  } catch (e) {
    console.error('[Share API] GET by token:', e)
    return NextResponse.json(
      { error: '리포트를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
