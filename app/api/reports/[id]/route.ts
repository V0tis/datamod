import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: '리포트 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: report, error } = await supabase
      .from('reports')
      .select('id, user_id, keyword, content, source_links, ai_responses, created_at')
      .eq('id', id)
      .single()

    if (error || !report) {
      return NextResponse.json(
        { error: '리포트를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (report.user_id !== user.id) {
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

    const sourceLinks = Array.isArray((report as { source_links?: unknown }).source_links)
      ? (report as { source_links: Array<{ title?: string; url?: string }> }).source_links
      : []

    const aiResponses = (report as { ai_responses?: Record<string, string> }).ai_responses ?? {}
    return NextResponse.json({
      id: report.id,
      keyword: report.keyword,
      created_at: report.created_at,
      marketNews: s?.marketNews ?? [],
      painPoints: s?.painPoints ?? [],
      competitorTrends: s?.competitorTrends ?? '',
      sentiment: typeof s?.sentiment === 'number' ? s.sentiment : 0,
      source_links: sourceLinks,
      ai_responses: aiResponses,
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
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: '리포트 ID가 필요합니다.' }, { status: 400 })
    }

    const { data: report, error: fetchError } = await supabase
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

    if (report.user_id !== user.id) {
      return NextResponse.json(
        { error: '이 리포트를 삭제할 수 없습니다.' },
        { status: 403 }
      )
    }

    const { error: deleteError } = await supabase
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
