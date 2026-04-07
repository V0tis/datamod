/**
 * POST /api/research/reset-analyzing
 * Clears a stuck research_history row stuck in `analyzing` for the given keyword (user-scoped).
 * Called before re-run / full reanalyze so "분석 중" DB 상태가 재시도를 막지 않도록 합니다.
 */
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/require-auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  const body = (await req.json().catch(() => ({}))) as {
    keyword?: string
    country_code?: string
  }
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : ''
  const country =
    typeof body.country_code === 'string' ? body.country_code.trim().toUpperCase().slice(0, 2) || 'KR' : 'KR'

  if (!keyword) {
    return NextResponse.json({ error: 'keyword가 필요합니다.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('research_history')
    .update({
      analysis_status: 'queued',
      progress_step: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('keyword', keyword)
    .eq('country_code', country)
    .eq('analysis_status', 'analyzing')

  if (error) {
    logger.warn('reset-analyzing: update failed', { message: error.message, keyword: keyword.slice(0, 40) })
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
