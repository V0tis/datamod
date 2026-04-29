'use client'

import { BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

/** 대시보드「최근 분석」탭 — 데이터 없을 때 */
export function DashboardRecentAnalysisEmpty({
  onStartAnalysis,
  disabled,
  className,
}: {
  onStartAnalysis: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <EmptyState
      className={cn('py-10', className)}
      icon={<BarChart3 className="text-slate-400 " strokeWidth={1.25} />}
      title="최근 분석 기록이 없습니다"
      description="시장 키워드를 검색해 분석을 실행하면 이곳에 최근 리포트가 표시됩니다."
      action={
        <Button type="button" size="sm" className="font-semibold" onClick={onStartAnalysis} disabled={disabled}>
          분석 시작
        </Button>
      }
    />
  )
}
