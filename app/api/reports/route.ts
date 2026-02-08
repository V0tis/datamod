import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 본인 데이터만 조회: supabase.auth.getUser() 후 user_id로 필터
// GET ?keyword=xxx → 해당 키워드 최신 리포트 1건 반환 (캐시 복원용, content + ai_responses 포함)
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const keyword = searchParams.get('keyword')?.trim()

    if (keyword) {
      const { data: report, error } = await supabase
        .from('reports')
        .select('id, keyword, content, source_links, ai_responses, created_at')
        .eq('user_id', user.id)
        .eq('keyword', keyword)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('[Reports API] get by keyword error:', error)
        return NextResponse.json(
          { error: '리포트를 불러오지 못했습니다.' },
          { status: 500 }
        )
      }
      if (!report) {
        return NextResponse.json({ report: null })
      }
      const c = report.content as Record<string, unknown> | null
      return NextResponse.json({
        report: {
          id: report.id,
          keyword: report.keyword,
          content: c ?? {},
          source_links: (report as { source_links?: unknown }).source_links ?? [],
          ai_responses: (report as { ai_responses?: Record<string, string> }).ai_responses ?? {},
          created_at: report.created_at,
        },
      })
    }

    const { data: reports, error } = await supabase
      .from('reports')
      .select('id, keyword, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) // 최신순

    if (error) {
      console.error('[Reports API] list error:', error)
      return NextResponse.json(
        { error: '리포트 목록을 불러오지 못했습니다.' },
        { status: 500 }
      )
    }

    const list = (reports ?? []).map((r) => ({
      id: r.id,
      keyword: r.keyword,
      created_at: r.created_at ?? null,
      date: r.created_at?.slice(0, 10) ?? '',
      sentiment: typeof (r.content as { sentiment?: number })?.sentiment === 'number'
        ? (r.content as { sentiment: number }).sentiment
        : 0,
      summary: [((r.content as { marketNews?: string[] })?.marketNews)?.[0]]
        .filter(Boolean)
        .join('') || '—',
    }))

    return NextResponse.json({ reports: list })
  } catch (e) {
    console.error('[Reports API] GET list:', e)
    return NextResponse.json(
      { error: '리포트 목록을 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}
