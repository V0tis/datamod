'use client'

import { toast } from 'sonner'
import { Loader2, Database, Lightbulb, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useResearchStore } from '@/lib/stores/research-store'

export interface AnalysisPhaseRerunBarProps {
  keyword: string
  countryCode?: string
  aiPrimaryModel?: 'gemini' | 'groq'
  disabled?: boolean
  className?: string
}

/**
 * Step-level partial re-run (2: insight+, 3: strategy+). Phase 1 = full re-analyze.
 */
export function AnalysisPhaseRerunBar({
  keyword,
  countryCode = 'KR',
  aiPrimaryModel,
  disabled = false,
  className,
}: AnalysisPhaseRerunBarProps) {
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const busy = useResearchStore((s) => s.isAnalyzingNow())

  const run = (rerun_from_phase: 1 | 2 | 3, label: string) => {
    const k = keyword.trim()
    if (!k) {
      toast.error('키워드가 없습니다.')
      return
    }
    if (busy) {
      toast.warning('이미 분석이 진행 중입니다.')
      return
    }
    toast.message(label)
    void startStreamingResearch(k, {
      country_code: countryCode,
      ai_primary_model: aiPrimaryModel,
      rerun_from_phase,
    })
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-border/80 bg-card/80 px-3 py-2',
        className
      )}
    >
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider shrink-0 mr-1">
        단계 재실행
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        disabled={disabled || busy}
        onClick={() => run(1, '전체 파이프라인을 다시 실행합니다.')}
      >
        <Database className="h-3.5 w-3.5" />
        1 · 데이터
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        disabled={disabled || busy}
        onClick={() => run(2, '인사이트 단계부터 다시 실행합니다.')}
      >
        <Lightbulb className="h-3.5 w-3.5" />
        2 · 인사이트
      </Button>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="h-8 text-xs gap-1.5"
        disabled={disabled || busy}
        onClick={() => run(3, '전략·실행 단계부터 다시 실행합니다.')}
      >
        <Target className="h-3.5 w-3.5" />
        3 · 전략
      </Button>
      {busy && (
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          실행 중
        </span>
      )}
    </div>
  )
}
