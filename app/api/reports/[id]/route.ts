import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: '리포트 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: report, error } = await getSupabase()
      .from('reports')
      .select('id, user_id, keyword, content, created_at')
      .eq('id', id)
      .single()

    if (error || !report) {
      return NextResponse.json(
        { error: '리포트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (report.user_id !== session.user.id) {
      return NextResponse.json(
        { error: '이 리포트에 접근할 수 없습니다.' },
        { status: 403 }
      )
    }

    const s = report.content as {
      marketNews?: string[]
      painPoints?: string[]
      competitorTrends?: string
      sentiment?: number
    }

    return NextResponse.json({
      id: report.id,
      keyword: report.keyword,
      created_at: report.created_at,
      marketNews: s?.marketNews ?? [],
      painPoints: s?.painPoints ?? [],
      competitorTrends: s?.competitorTrends ?? '',
      sentiment: typeof s?.sentiment === 'number' ? s.sentiment : 0,
    })
  } catch (e) {
    console.error('[Reports API] GET by id:', e)
    return NextResponse.json(
      { error: '리포트를 불러오지 못했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: '리포트 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: report, error: fetchError } = await getSupabase()
      .from('reports')
      .select('user_id')
      .eq('id', id)
      .single()

    if (fetchError || !report) {
      return NextResponse.json(
        { error: '리포트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (report.user_id !== session.user.id) {
      return NextResponse.json(
        { error: '이 리포트를 삭제할 수 없습니다.' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await getSupabase()
      .from('reports')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('[Reports API] DELETE error:', deleteError)
      return NextResponse.json(
        { error: '삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Reports API] DELETE:', e)
    return NextResponse.json(
      { error: '삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
}
