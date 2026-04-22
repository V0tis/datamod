'use client'

import { useCallback } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

export type PmExecutionReadinessHeaderProps = {
  readinessScore: number
  p0Count: number
  p1Count: number
  /** 교차검증 또는 분석 신뢰도 (0–100), 없으면 null */
  confidencePercent: number | null
  totalActions: number
  keyword: string
  /** 내보낼 행이 없으면 비활성 */
  exportDisabled?: boolean
  rowsForCsv: Array<{
    priority?: 'high' | 'medium' | 'low'
    action?: string
    how_to_execute?: string
    why?: string
  }>
}

export function PmExecutionReadinessHeader({
  readinessScore,
  p0Count,
  p1Count,
  confidencePercent,
  totalActions,
  keyword,
  exportDisabled,
  rowsForCsv,
}: PmExecutionReadinessHeaderProps) {
  const exportCsv = useCallback(() => {
    if (exportDisabled || rowsForCsv.length === 0) return
    const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const header = ['우선순위', '과제', '실행방법', '기대효과']
    const dataLines = rowsForCsv.map((r) => {
      const pr = r.priority === 'high' ? 'P0' : r.priority === 'low' ? 'P2' : 'P1'
      return [pr, r.action ?? '', r.how_to_execute ?? '', r.why ?? ''].map(esc).join(',')
    })
    const csv = `\uFEFF${[header.join(','), ...dataLines].join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pm-action-plan-${(keyword || 'export').replace(/[^\w가-힣-]+/g, '_').slice(0, 48)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('실행 플랜을 CSV로 내보냈습니다.')
  }, [rowsForCsv, keyword, exportDisabled])

  const confLine =
    confidencePercent != null
      ? `교차검증 신뢰도 ${confidencePercent}% · 총 ${totalActions}개 액션 도출`
      : `총 ${totalActions}개 액션 도출`

  return (
    <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-5 font-sans text-white shadow-md">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
          <div className="text-center sm:text-left">
            <div className="text-4xl font-black tabular-nums leading-none">{readinessScore}%</div>
            <div className="mt-0.5 text-xs text-blue-200">실행 준비도</div>
          </div>
          <div className="hidden h-12 w-px shrink-0 bg-blue-400/40 sm:block" aria-hidden />
          <div className="min-w-0">
            <p className="mb-1 text-sm font-semibold text-white">
              P0 {p0Count}건, P1 {p1Count}건이 즉시 실행 가능합니다
            </p>
            <p className="text-xs text-blue-200">{confLine}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={!!exportDisabled || rowsForCsv.length === 0}
          onClick={exportCsv}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          실행 플랜 내보내기
        </button>
      </div>
    </div>
  )
}
