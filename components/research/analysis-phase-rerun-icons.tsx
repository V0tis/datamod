'use client'

import { toast } from 'sonner'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useResearchStore } from '@/lib/stores/research-store'

export interface AnalysisPhaseRerunIconsProps {
  keyword: string
  countryCode?: string
  aiPrimaryModel?: 'gemini' | 'groq'
  disabled?: boolean
  className?: string
}

const STEPS: { phase: 1 | 2 | 3; label: string; toastLabel: string }[] = [
  { phase: 1, label: '데이터', toastLabel: '전체 파이프라인을 다시 실행합니다.' },
  { phase: 2, label: '인사이트', toastLabel: '인사이트 단계부터 다시 실행합니다.' },
  { phase: 3, label: '전략', toastLabel: '전략·실행 단계부터 다시 실행합니다.' },
]

export function AnalysisPhaseRerunIcons({
  keyword,
  countryCode = 'KR',
  aiPrimaryModel,
  disabled = false,
  className,
}: AnalysisPhaseRerunIconsProps) {
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
        'flex flex-wrap items-center gap-1 rounded-lg border border-border/80 bg-muted/30 px-1.5 py-1',
        className
      )}
      role="group"
      aria-label="단계별 재실행"
    >
      {STEPS.map(({ phase, label, toastLabel }, i) => (
        <div key={phase} className="flex items-center">
          {i > 0 ? <div className="mx-0.5 h-3 w-px shrink-0 bg-border" aria-hidden /> : null}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-7 gap-1 px-2 text-muted-foreground hover:text-foreground"
            disabled={disabled || busy}
            title={
              busy
                ? '분석이 진행 중입니다. 완료 또는 실패 후 사용할 수 있습니다.'
                : `${label} 단계부터 다시 실행`
            }
            onClick={() => run(phase, toastLabel)}
          >
            <span className="max-w-[3.5rem] truncate text-[11px] font-medium sm:max-w-none">{label}</span>
            <RotateCcw className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          </Button>
        </div>
      ))}
      {busy ? (
        <span className="ml-1 flex items-center gap-1 pl-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          실행 중
        </span>
      ) : null}
    </div>
  )
}
