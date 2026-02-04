import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: reports, error } = await getSupabase()
      .from('reports')
      .select('id, keyword, summary, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })

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
      date: r.created_at?.slice(0, 10) ?? '',
      sentiment: typeof (r.summary as { sentiment?: number })?.sentiment === 'number'
        ? (r.summary as { sentiment: number }).sentiment
        : 0,
      summary: [((r.summary as { marketNews?: string[] })?.marketNews)?.[0]]
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
