'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { OPPORTUNITY_RADAR_LABELS } from '@/lib/chart/opportunity-radar-display'
import { Info } from 'lucide-react'

const FORMULA_SUMMARY = `종합 기회 점수는 시장 온도(market_score), 긍정·중립 시그널 수, 경쟁사 수, 전략상 기회·리스크, 제품 액션 수를 수식으로 합산합니다. 레이더의 각 축은 같은 원시 breakdown 값을 가독성 있게 0~100 범위로 환산한 표시값입니다.`

const CHART_NARRATIVE_INTRO =
  '이 차트는 분석 파이프라인에서 산출된 지표·모형으로 그려지며, 실행 단계에서 생성된 chart_insights 텍스트와 연동됩니다.'

export function OpportunityChartSourceDialog({
  reasoning,
  breakdown,
  triggerLabel = '데이터 출처 확인',
  title = '차트·점수 근거',
  variant = 'breakdown',
}: {
  reasoning?: string | null
  breakdown?: Record<string, number | undefined | null> | null
  triggerLabel?: string
  title?: string
  /** breakdown: 기회 점수·레이더용 / chart_insight: 라인·바·영역 차트용 */
  variant?: 'breakdown' | 'chart_insight'
}) {
  const entries =
    variant === 'breakdown' && breakdown && typeof breakdown === 'object'
      ? Object.entries(breakdown).filter(([, v]) => typeof v === 'number' && Number.isFinite(v as number))
      : []

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="gap-1.5 shrink-0 text-xs">
          <Info className="h-3.5 w-3.5" aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(85vh,720px)] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border text-left">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4 text-sm text-foreground">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">산출 방식</p>
            <p className="leading-relaxed text-muted-foreground">
              {variant === 'breakdown' ? FORMULA_SUMMARY : CHART_NARRATIVE_INTRO}
            </p>
          </section>
          {reasoning?.trim() ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI 해설·근거</p>
              <p className="leading-relaxed whitespace-pre-wrap rounded-lg bg-muted/40 border border-border/60 p-3">{reasoning.trim()}</p>
            </section>
          ) : null}
          {entries.length > 0 ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">축별 원시 값 (breakdown)</p>
              <ul className="rounded-lg border border-border/60 divide-y divide-border/50 text-xs sm:text-sm">
                {entries.map(([k, v]) => (
                  <li key={k} className="flex justify-between gap-3 px-3 py-2">
                    <span className="text-muted-foreground">{OPPORTUNITY_RADAR_LABELS[k] ?? k}</span>
                    <span className="tabular-nums font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
