import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAnalysisJob } from '@/lib/research-job-runner'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { jobId?: string }
    const jobId = typeof body?.jobId === 'string' ? body.jobId.trim() : ''
    if (!jobId) {
      return NextResponse.json({ error: 'jobId가 필요합니다.' }, { status: 400 })
    }

    // Ensure the job belongs to the user (RLS)
    const { data: job } = await supabase
      .from('analysis_jobs')
      .select('id')
      .eq('id', jobId)
      .maybeSingle()

    if (!job?.id) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 })
    }

    const now = new Date().toISOString()
    await supabase
      .from('analysis_jobs')
      .update({ status: 'queued', error: null, progress_step: null, updated_at: now })
      .eq('id', jobId)

    void runAnalysisJob(jobId).catch((err) => {
      console.error('[Jobs Run API] runAnalysisJob error:', err)
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Jobs Run API] POST:', e)
    return NextResponse.json({ error: '작업 실행에 실패했습니다.' }, { status: 500 })
  }
}
