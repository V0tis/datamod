import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { InsightSnapshot } from '@/lib/insights-types'

/** GET /api/insights/[id] — single saved insight. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { data: row, error } = await supabase
    .from('saved_insights')
    .select('id, name, note, snapshot, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    note: row.note,
    snapshot: (row.snapshot ?? {}) as InsightSnapshot,
    created_at: row.created_at,
  })
}

/** DELETE /api/insights/[id] — delete saved insight. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('saved_insights')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
