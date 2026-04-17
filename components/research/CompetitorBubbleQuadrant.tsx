'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT } from '@/lib/chart-theme'
import { ChartWithInsight } from '@/components/research/ChartWithInsight'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import {
  type CompetitorScatterRow,
  type ScatterPayload,
  toScatterPayload,
} from '@/lib/competitor-bubble-data'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function BubbleTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload as (ScatterPayload & { size: number; tier: string }) | undefined
  if (!row) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[280px] rounded-xl border border-zinc-200/90 bg-white/98 px-3 py-2.5 text-xs shadow-xl backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95"
    >
      <p className="text-sm font-semibold text-foreground">{row.name}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">
        시장 점유(가로) {row.x.toFixed(1)} · 성장성(세로) {row.y.toFixed(1)}
      </p>
      {row.inferred ? (
        <p className="mt-0.5 text-[10px] text-amber-600 dark:text-amber-500">일부 좌표는 데이터 보강 추정</p>
      ) : null}
      {row.score_rationale ? (
        <p className="mt-2 line-clamp-4 text-[11px] leading-relaxed text-foreground/85">{row.score_rationale}</p>
      ) : null}
      <p className="mt-2 text-[10px] text-muted-foreground">클릭하면 근거 전문을 볼 수 있습니다.</p>
    </motion.div>
  )
}

const QUADRANT = {
  tl: '니치 · 고성장',
  tr: '우위 · 고성장',
  bl: '저존재 · 저성장',
  br: '대형 · 성장 둔화',
} as const

export function CompetitorBubbleQuadrant({
  competitors,
  className,
  pmCaption,
}: {
  competitors: CompetitorScatterRow[]
  className?: string
  /** 섹션 상단 고정: AI PM 한 줄 */
  pmCaption?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ScatterPayload | null>(null)
  if (!competitors.length) return null
  const data = toScatterPayload(competitors)

  return (
    <>
      <ChartWithInsight
        pmCaption={pmCaption}
        title="경쟁사 버블 매트릭스"
        insight="가로 시장 점유(1–10), 세로 성장성(1–10). 중앙 (5,5) 기준 4분면으로 포지션을 읽습니다. 버블을 클릭하면 좌표 산정 근거를 확인할 수 있습니다."
        className={className}
      >
        <div className="rounded-[12px] border border-zinc-200/90 bg-zinc-50/40 px-2 py-4 sm:px-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/30">
          <div className="relative h-[min(400px,58vw)] w-full min-h-[300px]">
            <div
              className="pointer-events-none absolute left-[14%] right-[10%] top-10 bottom-14 z-[5] text-[10px] font-medium text-muted-foreground/90"
              aria-hidden
            >
              <span className="absolute left-0 top-0 max-w-[7rem] leading-snug">{QUADRANT.tl}</span>
              <span className="absolute right-0 top-0 max-w-[7rem] text-right leading-snug">{QUADRANT.tr}</span>
              <span className="absolute left-0 bottom-0 max-w-[7rem] leading-snug">{QUADRANT.bl}</span>
              <span className="absolute right-0 bottom-0 max-w-[7rem] text-right leading-snug">{QUADRANT.br}</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 44 }}>
                <CartesianGrid stroke={CHART_GRAY_GRID} strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_GRAY_AXIS, strokeOpacity: 0.5 }}
                  label={{
                    value: '시장 점유 · 존재감 (1–10)',
                    position: 'bottom',
                    offset: 28,
                    fill: CHART_GRAY_AXIS,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_GRAY_AXIS, strokeOpacity: 0.5 }}
                  label={{
                    value: '성장성 (1–10)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 4,
                    fill: CHART_GRAY_AXIS,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  x={5}
                  stroke={CHART_GRAY_AXIS}
                  strokeDasharray="5 5"
                  strokeOpacity={0.65}
                  strokeWidth={1.25}
                />
                <ReferenceLine
                  y={5}
                  stroke={CHART_GRAY_AXIS}
                  strokeDasharray="5 5"
                  strokeOpacity={0.65}
                  strokeWidth={1.25}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  content={<BubbleTooltip />}
                  wrapperStyle={{ outline: 'none', zIndex: 20 }}
                />
                <Scatter
                  name="경쟁사"
                  data={data}
                  fill={CHART_MINT}
                  isAnimationActive
                  animationDuration={600}
                  shape={(props: unknown) => {
                    const p = props as Record<string, unknown>
                    const cx = Number(p.cx ?? 0)
                    const cy = Number(p.cy ?? 0)
                    const payload = p.payload as ScatterPayload
                    const r = Math.max(12, Math.min(40, ((payload?.size ?? 60) / 120) * 28 + 10))
                    const fill = payload?.fill ?? CHART_MINT
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={fill}
                        fillOpacity={0.92}
                        stroke="#0f172a"
                        strokeOpacity={0.35}
                        strokeWidth={2.5}
                        className="cursor-pointer outline-none transition-transform duration-200 ease-out hover:scale-[1.04]"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(15,23,42,0.18))' }}
                        onClick={() => {
                          setSelected(payload)
                          setOpen(true)
                        }}
                      />
                    )
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <ChartSourceFooter className="px-1" />
        </div>
      </ChartWithInsight>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setSelected(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? '경쟁사'}</DialogTitle>
            <DialogDescription asChild>
              <div className="text-left space-y-3 pt-1">
                <p className="tabular-nums text-sm text-muted-foreground">
                  시장 점유(가로) <strong className="text-foreground">{selected?.x.toFixed(1)}</strong> · 성장성(세로){' '}
                  <strong className="text-foreground">{selected?.y.toFixed(1)}</strong>
                  <span className="block text-xs mt-1">
                    기준선 5,5 기준{' '}
                    {(selected?.x ?? 0) >= 5 && (selected?.y ?? 0) >= 5
                      ? '고점유·고성장 우상단'
                      : (selected?.x ?? 0) < 5 && (selected?.y ?? 0) >= 5
                        ? '저점유·고성장 좌상단'
                        : (selected?.x ?? 0) < 5 && (selected?.y ?? 0) < 5
                          ? '저점유·저성장 좌하단'
                          : '고점유·저성장 우하단'}{' '}
                    구간에 위치합니다.
                  </span>
                </p>
                {selected?.inferred ? (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    일부 축은 리서치 데이터 보강을 위해 추정되었습니다.
                  </p>
                ) : null}
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    좌표 산정 근거
                  </p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {selected?.score_rationale?.trim() ||
                      '모델이 별도 근거 문장을 반환하지 않았습니다. 시장 점유·성장성은 수집된 리서치 텍스트의 상대 비교로 산정되었을 수 있습니다.'}
                  </p>
                </div>
                {selected?.positioning ? (
                  <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
                    포지셔닝: {selected.positioning}
                  </p>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
