import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
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
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    }

    const { data: job } = await supabase
      .from('analysis_jobs')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()

    if (!job?.id) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
      return NextResponse.json({ ok: true })
    }

    const { error } = await supabase
      .from('analysis_jobs')
      .update({
        status: 'cancelled',
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('[Jobs API] cancel:', error)
      return NextResponse.json({ error: '작업 취소에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Jobs API] PATCH:', e)
    return NextResponse.json({ error: '작업 취소에 실패했습니다.' }, { status: 500 })
  }
}
