import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runAnalysisJob } from '@/lib/research-job-runner'

/** Authoritative analysis status. UI renders ONLY from this. */
type AnalysisStatus = 'queued' | 'analyzing' | 'completed' | 'failed'

type JobRow = {
  id: string
  keyword: string
  country_code: string
  status: string
  progress_step: string | null
  error: string | null
  report_id: string | null
  created_at: string
  updated_at: string
}

/** Map job status to canonical analysis_status. One-directional: queued→analyzing→completed|failed */
function jobStatusToAnalysisStatus(status: string): AnalysisStatus {
  switch (status) {
    case 'queued': return 'queued'
    case 'running': return 'analyzing'
    case 'succeeded': return 'completed'
    case 'failed':
    case 'cancelled': return 'failed'
    default: return 'queued'
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ list: [] }, { status: 401 })
    }

    const { data: rows, error } = await supabase
      .from('analysis_jobs')
      .select('id, keyword, country_code, status, progress_step, error, report_id, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('[Jobs API] list:', error)
      return NextResponse.json({ list: [], error: error.message }, { status: 500 })
    }

    const list = ((rows ?? []) as JobRow[]).map((job) => ({
      ...job,
      analysis_status: jobStatusToAnalysisStatus(job.status),
    }))
    return NextResponse.json({ list })
  } catch (e) {
    console.error('[Jobs API] GET:', e)
    return NextResponse.json({ list: [] }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { keyword?: string; country_code?: string }
    const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : ''
    const countryCode = typeof body?.country_code === 'string' ? body.country_code.trim() || 'KR' : 'KR'
    if (!keyword) {
      return NextResponse.json({ error: '검색어(keyword)가 필요합니다.' }, { status: 400 })
    }

    const { data: job, error: insertError } = await supabase
      .from('analysis_jobs')
      .insert({
        user_id: user.id,
        keyword,
        country_code: countryCode,
        status: 'queued',
        updated_at: new Date().toISOString(),
      })
      .select('id, keyword, country_code, status, progress_step, error, report_id, created_at, updated_at')
      .single()

    if (insertError || !job) {
      console.error('[Jobs API] insert:', insertError)
      return NextResponse.json({ error: '작업 생성에 실패했습니다.' }, { status: 500 })
    }

    // Fire-and-forget: run on server side; if it fails, job remains queued for retry.
    void runAnalysisJob(job.id).catch((err) => {
      console.error('[Jobs API] runAnalysisJob error:', err)
    })

    return NextResponse.json({ job })
  } catch (e) {
    console.error('[Jobs API] POST:', e)
    return NextResponse.json({ error: '작업 생성에 실패했습니다.' }, { status: 500 })
  }
}
