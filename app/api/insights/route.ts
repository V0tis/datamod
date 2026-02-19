import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { InsightSnapshot } from '@/lib/insights-types'

/** GET /api/insights — list saved insights for current user. ?q= filters by name/keyword. */
export async function GET(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()?.toLowerCase() ?? ''

  let query = supabase
    .from('saved_insights')
    .select('id, name, note, snapshot, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: rows, error } = await query

  if (error) {
    console.error('[Insights] list:', error)
    return NextResponse.json({ list: [], error: error.message }, { status: 500 })
  }

  let list = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? '',
    note: r.note ?? null,
    snapshot: (r.snapshot ?? {}) as InsightSnapshot,
    created_at: r.created_at ?? '',
  }))

  if (q) {
    list = list.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(q)
      const keywordMatch = item.snapshot?.keyword?.toLowerCase().includes(q)
      const noteMatch = item.note?.toLowerCase().includes(q)
      return nameMatch || keywordMatch || noteMatch
    })
  }

  return NextResponse.json({ list })
}

/** POST /api/insights — save new insight. Body: { name, note?, snapshot }. */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: { name?: string; note?: string; snapshot?: InsightSnapshot }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) {
    return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 })
  }

  const note = typeof body?.note === 'string' ? body.note.trim() || null : null
  const snapshot = body?.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {}
  const s = snapshot as Partial<InsightSnapshot>
  const snapshotWithTime: InsightSnapshot = {
    keyword: s.keyword ?? '',
    countryCode: s.countryCode,
    summary: s.summary,
    strategicSummary: s.strategicSummary,
    reportId: s.reportId,
    savedAt: s.savedAt ?? new Date().toISOString(),
  }

  const { data: row, error } = await supabase
    .from('saved_insights')
    .insert({
      user_id: user.id,
      name,
      note,
      snapshot: snapshotWithTime,
    })
    .select('id, name, note, snapshot, created_at')
    .single()

  if (error) {
    console.error('[Insights] insert:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    id: row.id,
    name: row.name,
    note: row.note,
    snapshot: row.snapshot,
    created_at: row.created_at,
  })
}
