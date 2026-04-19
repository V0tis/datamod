'use client'

import { useMemo, useState } from 'react'
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
import { chartAxisMuted, chartFontFamily, chartGridMuted } from '@/lib/chartTheme'
import { ChartWithInsight } from '@/components/research/ChartWithInsight'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import { type CompetitorScatterRow, type ScatterPayload, toScatterPayload } from '@/lib/competitor-bubble-data'
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
  const desc = [row.positioning, row.differentiation].filter(Boolean).join(' · ')
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-[280px] rounded-xl border border-zinc-200/90 bg-white/98 px-3 py-2.5 text-xs shadow-xl backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-950/95"
      style={{ fontFamily: chartFontFamily }}
    >
      <p className="text-sm font-semibold text-foreground">{row.name}</p>
      <p className="mt-1 tabular-nums text-muted-foreground">
        시장 점유(X) {row.x.toFixed(1)} · 성장성(Y) {row.y.toFixed(1)}
      </p>
      {desc ? <p className="mt-2 line-clamp-5 text-[11px] leading-relaxed text-foreground/90">{desc}</p> : null}
      {row.score_rationale ? (
        <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">{row.score_rationale}</p>
      ) : null}
      {row.inferred ? (
        <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">일부 좌표는 데이터 보강 추정</p>
      ) : null}
    </motion.div>
  )
}

const QUADRANT = {
  tl: '니치 · 고성장',
  tr: '우위 · 고성장',
  bl: '저존재 · 저성장',
  br: '우위 · 저성장',
} as const

function truncateName(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function CompetitorBubbleQuadrant({
  competitors,
  className,
  pmCaption,
  keyword,
}: {
  competitors: CompetitorScatterRow[]
  className?: string
  pmCaption?: string | null
  /** 자사(우리 회사) 버블 강조: 키워드와 경쟁사 이름 일치 시 */
  keyword?: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ScatterPayload | null>(null)
  if (!competitors.length) return null

  const data = useMemo(() => {
    const base = toScatterPayload(competitors)
    const k = keyword?.trim().toLowerCase()
    return base.map((row) => ({
      ...row,
      isOurCompany: Boolean(k && row.name.trim().toLowerCase() === k),
    }))
  }, [competitors, keyword])

  return (
    <>
      <ChartWithInsight
        pmCaption={pmCaption}
        title="경쟁사 버블 매트릭스 · 시장 점유·성장성 (1–10)"
        description="가로·세로 5를 기준으로 네 구간을 나눕니다. 버블 안 이름으로 주체를 구분하고, 호버 시 좌표·설명을 확인합니다."
        insight="가로 시장 점유(1–10), 세로 성장성(1–10). 중앙 (5,5) 기준 4분면으로 포지션을 읽습니다."
        className={className}
      >
        <div className="rounded-[12px] border border-zinc-200/90 bg-zinc-50/40 px-2 py-4 sm:px-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/30">
          <div className="relative h-[min(420px,62vw)] w-full min-h-[220px]">
            {/* 4분면 배경 (약 5% 투명) — 차트 플롯 영역 근사 */}
            <div
              className="pointer-events-none absolute left-[10%] right-[8%] top-10 bottom-12 z-[1] grid grid-cols-2 grid-rows-2 overflow-hidden rounded-lg"
              aria-hidden
            >
              <div className="bg-sky-500/[0.05] dark:bg-sky-400/[0.06]" title={QUADRANT.tl} />
              <div className="bg-emerald-500/[0.05] dark:bg-emerald-400/[0.06]" title={QUADRANT.tr} />
              <div className="bg-zinc-500/[0.05] dark:bg-zinc-400/[0.06]" title={QUADRANT.bl} />
              <div className="bg-amber-400/[0.05] dark:bg-amber-300/[0.06]" title={QUADRANT.br} />
            </div>
            <div
              className="pointer-events-none absolute left-[14%] right-[10%] top-10 bottom-14 z-[5] text-[10px] font-medium text-muted-foreground/90"
              aria-hidden
            >
              <span className="absolute left-0 top-1 max-w-[7rem] leading-snug">{QUADRANT.tl}</span>
              <span className="absolute right-0 top-1 max-w-[7rem] text-right leading-snug">{QUADRANT.tr}</span>
              <span className="absolute left-0 bottom-1 max-w-[7rem] leading-snug">{QUADRANT.bl}</span>
              <span className="absolute right-0 bottom-1 max-w-[7rem] text-right leading-snug">{QUADRANT.br}</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 44 }} style={{ fontFamily: chartFontFamily }}>
                <CartesianGrid stroke={chartGridMuted} strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tick={{ fontSize: 11, fill: chartAxisMuted }}
                  tickLine={false}
                  axisLine={{ stroke: chartAxisMuted, strokeOpacity: 0.5 }}
                  label={{
                    value: '시장 점유 · 존재감 (1–10)',
                    position: 'bottom',
                    offset: 28,
                    fill: chartAxisMuted,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tick={{ fontSize: 11, fill: chartAxisMuted }}
                  tickLine={false}
                  axisLine={{ stroke: chartAxisMuted, strokeOpacity: 0.5 }}
                  label={{
                    value: '성장성 (1–10)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 4,
                    fill: chartAxisMuted,
                    fontSize: 11,
                  }}
                />
                <ReferenceLine x={5} stroke={chartAxisMuted} strokeDasharray="5 5" strokeOpacity={0.65} strokeWidth={1.25} />
                <ReferenceLine y={5} stroke={chartAxisMuted} strokeDasharray="5 5" strokeOpacity={0.65} strokeWidth={1.25} />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  content={<BubbleTooltip />}
                  wrapperStyle={{ outline: 'none', zIndex: 20 }}
                />
                <Scatter
                  name="경쟁사"
                  data={data}
                  fill="#10b981"
                  isAnimationActive
                  animationDuration={600}
                  shape={(props: unknown) => {
                    const p = props as Record<string, unknown>
                    const cx = Number(p.cx ?? 0)
                    const cy = Number(p.cy ?? 0)
                    const payload = p.payload as ScatterPayload
                    const r = Math.max(14, Math.min(44, ((payload?.size ?? 60) / 120) * 30 + 12))
                    const fill = payload?.fill ?? '#10b981'
                    const isUs = payload?.isOurCompany
                    const name = payload?.name ?? ''
                    const fs = Math.max(9, Math.min(13, r / 2.4))
                    const label = truncateName(name, r > 28 ? 14 : 10)
                    return (
                      <g
                        className="cursor-pointer outline-none"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(15,23,42,0.2))' }}
                        onClick={() => {
                          setSelected(payload)
                          setOpen(true)
                        }}
                      >
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={fill}
                          fillOpacity={isUs ? 1 : 0.92}
                          stroke={isUs ? '#F59E0B' : '#0f172a'}
                          strokeOpacity={isUs ? 1 : 0.35}
                          strokeWidth={isUs ? 3 : 2.5}
                          className="transition-transform duration-200 ease-out hover:scale-[1.03]"
                        />
                        <text
                          x={cx}
                          y={cy + (isUs ? -3 : 0)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="#fff"
                          fontWeight={700}
                          fontSize={fs}
                          style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}
                        >
                          {label}
                        </text>
                        {isUs ? (
                          <text
                            x={cx}
                            y={cy + fs * 0.75}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#FEF3C7"
                            fontSize={Math.max(10, fs * 0.55)}
                            fontWeight={800}
                            style={{ pointerEvents: 'none' }}
                          >
                            자사
                          </text>
                        ) : null}
                      </g>
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
              <div className="space-y-3 pt-1 text-left">
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
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">좌표 산정 근거</p>
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
