'use client'

import { useState, useCallback } from 'react'
import { CheckSquare, Bookmark, Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

/** Map -100~100 to 0–100 (same as MarketTemperature). */
function toZeroHundred(score: number): number {
  return Math.round(Math.max(0, Math.min(100, (score + 100) / 2)))
}

/** Market temp bands: Cold/Cool/Warm/Hot. */
type TempBand = 'cold' | 'cool' | 'warm' | 'hot'
function getTempBand(normalized: number): TempBand {
  if (normalized < 25) return 'cold'
  if (normalized < 50) return 'cool'
  if (normalized < 75) return 'warm'
  return 'hot'
}

/** Competition intensity: from impact "경쟁력" score (0–10). Low < 4, Medium 4–7, High > 7. */
type CompetitionLevel = 'low' | 'medium' | 'high'
function getCompetitionLevel(score: number): CompetitionLevel {
  if (score < 4) return 'low'
  if (score <= 7) return 'medium'
  return 'high'
}

/** Signal confidence bands: Low < 50, Medium 50–80, High > 80. */
type ConfidenceLevel = 'low' | 'medium' | 'high'
function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence < 50) return 'low'
  if (confidence <= 80) return 'medium'
  return 'high'
}

/**
 * Maps market temp, competition intensity, and signal confidence to 3–5 PM-relevant advisory actions.
 * Advisory tone only: "고려해 보시길", "검토를 권합니다" — never commands.
 * Priority: market temp → competition → confidence. Cap at 5.
 */
function deriveActions(
  marketTempNormalized: number,
  competitionLevel: CompetitionLevel,
  confidenceLevel: ConfidenceLevel
): string[] {
  const actions: string[] = []
  const tempBand = getTempBand(marketTempNormalized)

  // --- 1. Market temperature (primary): 2 actions per band ---
  if (tempBand === 'cold') {
    actions.push('시장 수요 검증을 위해 타깃 사용자 5–10명과 심층 인터뷰를 진행해 보시는 것을 고려해 보시길 바랍니다.')
    actions.push('MVP 범위를 좁혀 핵심 가설 1–2개만 검증하는 방안을 검토해 보시길 권합니다.')
  } else if (tempBand === 'cool') {
    actions.push('MVP 스코프를 정한 뒤, 빠른 프로토타입으로 반응을 테스트해 보시는 것을 제안드립니다.')
    actions.push('포지셔닝 메시지 A/B 테스트로 어떤 프레이밍이 공감을 얻는지 확인해 보시길 권합니다.')
  } else if (tempBand === 'warm') {
    actions.push('가격 민감도 테스트(예: 2–3개 티어)를 통해 수용 가능 구간을 파악해 보시길 권합니다.')
    actions.push('지표 기반으로 PMF 지표 1–2개를 정의하고, 주간으로 추적해 보시는 것을 제안드립니다.')
  } else {
    actions.push('스케일 전 확보해야 할 핵심 리소스·파트너십을 정리해 보시는 것을 고려해 보시길 바랍니다.')
    actions.push('경쟁 대비 차별화 포인트를 명확히 하고, 이를 제품 로드맵에 반영해 보시길 권합니다.')
  }

  // --- 2. Competition intensity: +1 if distinct ---
  if (competitionLevel === 'low') {
    actions.push('경쟁이 상대적으로 완만한 구간이므로, 선점을 위한 실행 속도를 높여 보시는 것을 검토해 보시길 권합니다.')
  } else if (competitionLevel === 'high') {
    actions.push('경쟁 강도가 높은 편이므로, 특정 세그먼트·니치에 집중하는 전략을 검토해 보시길 권합니다.')
  }

  // --- 3. Signal confidence: +1 if low (caution) or high (opportunity) ---
  if (confidenceLevel === 'low') {
    actions.push('신호 신뢰도가 보통 수준이므로, 1차 리서치(인터뷰·설문)로 보완해 보시는 것을 권합니다.')
  } else if (confidenceLevel === 'high' && tempBand !== 'cold') {
    actions.push('신호 신뢰도가 높은 편이므로, 단계적 확장 계획을 수립해 보시는 것을 고려해 보시길 바랍니다.')
  }

  return actions.slice(0, 5)
}

export interface SuggestedPMActionsProps {
  /** Market temp raw score -100~100 */
  marketTempScore: number | null
  /** Competition score 0–10 (e.g. from impactAnalysis "경쟁력") */
  competitionScore: number | null
  /** Signal confidence 0–100 */
  signalConfidence: number | null
  /** Called when user wants to save these actions as insight. Receives action list for note prefill. */
  onSaveAsInsight?: (actions: string[]) => void
  className?: string
}

/**
 * Suggested PM Actions: decision-support layer below analysis summary.
 * Maps market temp, competition, confidence → 3–5 advisory actions.
 * Advisory tone only; supports save-as-insight and checklist copy.
 */
export function SuggestedPMActions({
  marketTempScore,
  competitionScore,
  signalConfidence,
  onSaveAsInsight,
  className,
}: SuggestedPMActionsProps) {
  const [copied, setCopied] = useState(false)

  const marketTempNorm = marketTempScore != null && Number.isFinite(marketTempScore)
    ? toZeroHundred(marketTempScore)
    : 50 // fallback to neutral
  const compScore = competitionScore != null && Number.isFinite(competitionScore)
    ? Math.max(0, Math.min(10, competitionScore))
    : 5
  const conf = signalConfidence != null && Number.isFinite(signalConfidence)
    ? Math.max(0, Math.min(100, signalConfidence))
    : 60

  const actions = deriveActions(
    marketTempNorm,
    getCompetitionLevel(compScore),
    getConfidenceLevel(conf)
  )

  const handleCopyChecklist = useCallback(async () => {
    const text = actions
      .map((a, i) => `- [ ] ${i + 1}. ${a}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('체크리스트가 클립보드에 복사되었습니다.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }, [actions])

  if (actions.length === 0) return null

  return (
    <section
      className={cn('rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5 reading-section-gap', className)}
      aria-label="Suggested PM Actions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">제안 PM 액션</h2>
        <p className="text-[11px] text-muted-foreground">
          시장 온도·경쟁 강도·신뢰도를 바탕으로 한 의사결정 참고용 제안입니다.
        </p>
      </div>
      <ul className="space-y-2 list-none pl-0 text-sm text-foreground">
        {actions.map((action, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-primary shrink-0">·</span>
            <span className="break-words">{action}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/40">
        {onSaveAsInsight && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => onSaveAsInsight(actions)}
          >
            <Bookmark className="h-3.5 w-3.5" />
            인사이트로 저장
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={handleCopyChecklist}
          disabled={copied}
        >
          {copied ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckSquare className="h-3.5 w-3.5" />
          )}
          {copied ? '복사됨' : '체크리스트로 복사'}
        </Button>
      </div>
    </section>
  )
}
