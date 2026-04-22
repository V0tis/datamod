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
import { cn } from '@/lib/utils'
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
  tr: '우위 · 고성장 ✅',
  bl: '저존재 · 저성장',
  br: '우위 · 저성장',
} as const

const X_AXIS_CAPTION = '시장 점유 · 존재감 (1–10)'

/** 상·하단 4분면 캡션 + 축 제목을 같은 열 정렬로 맞춤 */
const quadrantCaptionGrid =
  'grid w-full grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_minmax(0,1fr)] gap-x-2 px-2 sm:px-3'
const quadrantCaptionText =
  'text-[11px] font-medium leading-snug text-slate-300 [word-break:keep-all] dark:text-zinc-500'

function truncateName(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

const OUR_FILL = '#1B64DA'

export function CompetitorBubbleQuadrant({
  competitors,
  className,
  pmCaption,
  keyword,
  embedded = false,
}: {
  competitors: CompetitorScatterRow[]
  className?: string
  pmCaption?: string | null
  /** 자사(우리 회사) 버블 강조: 키워드와 경쟁사 이름 일치 시 */
  keyword?: string
  /** true면 ChartWithInsight 래퍼 없이 카드만 (상위 섹션 제목과 병치) */
  embedded?: boolean
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

  const chartCard = (
    <div
      className={cn(
        'rounded-[12px] border border-zinc-200/90 bg-zinc-50/40 px-2 py-4 sm:px-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-zinc-800 dark:bg-zinc-950/30',
        embedded && 'h-full border-border bg-card shadow-sm dark:bg-zinc-950/80'
      )}
    >
      <div className="flex min-w-0 flex-col">
        {embedded ? (
          <div className="mb-2 border-b border-border/60 px-1 pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">버블 매트릭스</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">시장 점유·성장성 (1–10), 중앙 (5,5) 기준 4분면</p>
          </div>
        ) : null}
        <div
          className={cn(quadrantCaptionGrid, 'pointer-events-none min-h-[2.25rem] items-center border-b border-transparent pb-2')}
          aria-hidden
        >
          <span className={cn(quadrantCaptionText, 'justify-self-start text-left')}>{QUADRANT.tl}</span>
          <span className="min-w-[min(100%,10rem)] shrink-0 justify-self-center" aria-hidden />
          <span className={cn(quadrantCaptionText, 'justify-self-end text-right')}>{QUADRANT.tr}</span>
        </div>
        <div className="relative h-[min(420px,62vw)] w-full min-h-[220px]">
            <div
              className="pointer-events-none absolute left-[12%] right-[10%] top-2 bottom-4 z-[1] grid grid-cols-2 grid-rows-2 overflow-hidden rounded-lg"
              aria-hidden
            >
              <div className="dark:bg-[rgba(27,100,218,0.08)]" style={{ background: 'rgba(27, 100, 218, 0.05)' }} title={QUADRANT.tl} />
              <div className="dark:bg-[rgba(13,159,110,0.08)]" style={{ background: 'rgba(13, 159, 110, 0.05)' }} title={QUADRANT.tr} />
              <div className="dark:bg-[rgba(255,255,255,0.04)]" style={{ background: 'rgba(0, 0, 0, 0.02)' }} title={QUADRANT.bl} />
              <div className="dark:bg-[rgba(217,119,6,0.08)]" style={{ background: 'rgba(217, 119, 6, 0.05)' }} title={QUADRANT.br} />
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 28, bottom: 36 }} style={{ fontFamily: chartFontFamily }}>
                <CartesianGrid stroke={chartGridMuted} strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[1, 10]}
                  ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
                  tick={{ fontSize: 11, fill: chartAxisMuted }}
                  tickLine={false}
                  axisLine={{ stroke: chartAxisMuted, strokeOpacity: 0.5 }}
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
                    const cellIndex = Number(p.index ?? 0)
                    const cx = Number(p.cx ?? 0)
                    const cy = Number(p.cy ?? 0)
                    const payload = p.payload as ScatterPayload
                    const r = Math.max(14, Math.min(44, ((payload?.size ?? 60) / 120) * 30 + 12))
                    const tierFill = payload?.fill ?? '#10b981'
                    const isUs = payload?.isOurCompany
                    const fill = isUs ? OUR_FILL : tierFill
                    const name = payload?.name ?? ''
                    const dPx = 2 * r
                    const labelInside = dPx > 60
                    const fs = Math.max(9, Math.min(12, r / 2.6))
                    const approxChar = fs * 0.92
                    const maxChars = Math.max(4, Math.min(16, Math.floor(((2 * r - 10) / approxChar) * 0.95)))
                    const labelIn = truncateName(name, maxChars)
                    const labelOut = truncateName(name, 22)
                    const clipId = `bubble-txt-${cellIndex}-${Math.round(cx)}-${Math.round(cy)}`
                    /** 자사: 금색 별 (간단 폴리곤) */
                    const starY = isUs ? cy - r * 0.15 : cy
                    return (
                      <g
                        className="cursor-pointer outline-none"
                        style={{ filter: 'drop-shadow(0 2px 6px rgba(15,23,42,0.18))' }}
                        onClick={() => {
                          setSelected(payload)
                          setOpen(true)
                        }}
                      >
                        <defs>
                          <clipPath id={clipId}>
                            <circle cx={cx} cy={cy} r={Math.max(4, r - 3)} />
                          </clipPath>
                        </defs>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={fill}
                          fillOpacity={isUs ? 1 : 0.92}
                          stroke="#ffffff"
                          strokeWidth={2}
                          className="transition-transform duration-200 ease-out hover:scale-[1.03]"
                        />
                        {isUs ? (
                          <g
                            pointerEvents="none"
                            transform={`translate(${cx - 7}, ${starY - 10})`}
                            style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.35))' }}
                          >
                            <polygon
                              points="7,0 8.5,5 14,5.5 10,9 11.5,14 7,11 2.5,14 4,9 0,5.5 5.5,5"
                              fill="#FBBF24"
                              stroke="#fff"
                              strokeWidth={0.4}
                            />
                          </g>
                        ) : null}
                        {labelInside ? (
                          <text
                            x={cx}
                            y={cy + (isUs ? r * 0.12 : 0)}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#fff"
                            fontWeight={700}
                            fontSize={fs}
                            clipPath={`url(#${clipId})`}
                            style={{
                              pointerEvents: 'none',
                              textShadow: '0 1px 2px rgba(0,0,0,0.45)',
                              paintOrder: 'stroke fill',
                            }}
                            stroke="rgba(15,23,42,0.25)"
                            strokeWidth={1.5}
                          >
                            {labelIn}
                          </text>
                        ) : (
                          <g>
                            <line
                              x1={cx}
                              y1={cy + r}
                              x2={cx}
                              y2={cy + r + 7}
                              stroke="#94a3b8"
                              strokeWidth={1}
                              strokeOpacity={0.9}
                            />
                            <text
                              x={cx}
                              y={cy + r + 20}
                              textAnchor="middle"
                              fill="#475569"
                              fontSize={10}
                              fontWeight={600}
                              style={{ pointerEvents: 'none' }}
                            >
                              {labelOut}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
        </div>
        <div
          className={cn(
            quadrantCaptionGrid,
            'pointer-events-none items-end gap-y-0.5 border-t border-zinc-200/60 pt-2.5 pb-0.5 dark:border-zinc-700/60'
          )}
          aria-hidden
        >
          <span className={cn(quadrantCaptionText, 'justify-self-start pb-0.5 text-left')}>{QUADRANT.bl}</span>
          <span
            className="justify-self-center px-1 pb-0.5 text-center text-[11px] font-medium leading-tight text-muted-foreground [word-break:keep-all]"
            style={{ fontFamily: chartFontFamily }}
          >
            {X_AXIS_CAPTION}
          </span>
          <span className={cn(quadrantCaptionText, 'justify-self-end pb-0.5 text-right')}>{QUADRANT.br}</span>
        </div>
      </div>
      <ChartSourceFooter className="px-1 pt-2" />
    </div>
  )

  return (
    <>
      {embedded ? (
        <div className={cn('min-w-0', className)}>{chartCard}</div>
      ) : (
        <ChartWithInsight
          pmCaption={pmCaption}
          title="경쟁사 버블 매트릭스 · 시장 점유·성장성 (1–10)"
          description="가로·세로 5를 기준으로 네 구간을 나눕니다. 버블에 이름이 표시되며, 호버 시 상세를 확인합니다."
          insight="가로 시장 점유(1–10), 세로 성장성(1–10). 중앙 (5,5) 기준 4분면으로 포지션을 읽습니다."
          className={className}
        >
          {chartCard}
        </ChartWithInsight>
      )}

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
