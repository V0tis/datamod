/**
 * Analysis API layer: all server calls for analysis jobs live here.
 * Keeps UI and store free of fetch/URL logic; easier to add retries, logging, or swap backend.
 */
import type { AnalysisJob } from '@/lib/stores/research-store'

export type CreateJobPayload = { keyword: string; country_code?: string }
export type CreateJobResult = { job: AnalysisJob } | { error: string }

export async function createJob(payload: CreateJobPayload): Promise<CreateJobResult> {
  const res = await fetch('/api/research/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword: payload.keyword.trim(),
      country_code: (payload.country_code ?? 'KR').trim() || 'KR',
    }),
  })
  const data = await res.json()
  if (!res.ok) return { error: (data as { error?: string }).error ?? 'Request failed' }
  const job = (data as { job?: AnalysisJob }).job
  if (!job) return { error: 'No job returned' }
  return { job }
}

export type JobsListResult = { list: AnalysisJob[] } | { error?: string }

export async function fetchJobs(): Promise<JobsListResult> {
  const res = await fetch('/api/research/jobs')
  const data = await res.json()
  if (!res.ok) return { list: [], error: (data as { error?: string }).error }
  return { list: (data as { list?: AnalysisJob[] }).list ?? [] }
}

export async function retryJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/research/jobs/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? 'Retry failed' }
  }
  return { ok: true }
}

export async function cancelJob(jobId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/research/jobs/${encodeURIComponent(jobId)}`, { method: 'PATCH' })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: (data as { error?: string }).error ?? 'Cancel failed' }
  }
  return { ok: true }
}
