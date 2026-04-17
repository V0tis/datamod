/**
 * Phase 2 (시장 트렌드 + 경쟁)는 서버에서 병렬 실행되므로,
 * UI에서는 시장 행이 끝날 때까지 경쟁 행에 'running'을 표시하지 않아 동시 로딩바를 막는다.
 */

export type Phase2TaskLike = { status: string } | undefined

export type Phase2PipelineRowStatus = 'pending' | 'running' | 'completed' | 'failed'

export function getPhase2TrendRowStatus(tr: Phase2TaskLike): Phase2PipelineRowStatus {
  const s = tr?.status
  if (s === 'failed') return 'failed'
  if (s === 'running') return 'running'
  if (s === 'completed') return 'completed'
  return 'pending'
}

export function getPhase2CompetitionRowStatus(
  tr: Phase2TaskLike,
  co: Phase2TaskLike
): Phase2PipelineRowStatus {
  const cs = co?.status
  if (cs === 'failed') return 'failed'
  const ts = tr?.status
  if (ts !== 'completed') {
    return 'pending'
  }
  if (cs === 'running') return 'running'
  if (cs === 'completed') return 'completed'
  return 'pending'
}
