'use client'

import { Crown, TrendingUp, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Competitor = { name?: string; positioning?: string; strength?: string; weakness?: string }

type Tier = 'leader' | 'challenger' | 'niche' | 'emerging'

const TIER_CONFIG: Record<Tier, { label: string; labelEn: string; description: string; icon: typeof Crown; color: string; dotColor: string }> = {
  leader: { label: '시장 리더', labelEn: 'Leader', description: '점유율 + 영향력 높음', icon: Crown, color: 'border-blue-500/50 bg-blue-500/10', dotColor: 'bg-blue-500' },
  challenger: { label: '주요 경쟁자', labelEn: 'Challenger', description: '성장 중', icon: TrendingUp, color: 'border-emerald-500/50 bg-emerald-500/10', dotColor: 'bg-emerald-500' },
  niche: { label: '특정 시장 집중', labelEn: 'Niche', description: '니치·특화 포지션', icon: Zap, color: 'border-amber-500/50 bg-amber-500/10', dotColor: 'bg-amber-500' },
  emerging: { label: '신규 / 초기 단계', labelEn: 'Emerging', description: '신규 진입 또는 초기 성장', icon: TrendingUp, color: 'border-gray-400/50 bg-gray-400/10', dotColor: 'bg-gray-400' },
}

function inferTier(c: Competitor, index: number, total: number): Tier {
  const pos = (c.positioning ?? '').toLowerCase()
  if (/리더|선도|1위|시장 지배|대표|최대/.test(pos)) return 'leader'
  if (/도전|challenger|2위|3위|추격/.test(pos)) return 'challenger'
  if (/니치|niche|특화|전문|틈새/.test(pos)) return 'niche'
  if (/초기|스타트업|신규|신생|초창기|성장|확대|부상|신흥|emerging/.test(pos)) return 'emerging'
  if (total <= 2) return index === 0 ? 'leader' : 'challenger'
  if (total <= 3) return index === 0 ? 'leader' : index === 1 ? 'challenger' : 'emerging'
  const q = Math.ceil(total / 4)
  if (index < q) return 'leader'
  if (index < q * 2) return 'challenger'
  if (index < q * 3) return 'niche'
  return 'emerging'
}

/** Infer x (0-100) market maturity and y (0-100) product complexity from positioning */
function inferPosition(c: Competitor, index: number, total: number): { x: number; y: number } {
  const pos = (c.positioning ?? '').toLowerCase()
  let x = 30 + (index / Math.max(1, total - 1)) * 40
  let y = 30 + ((index % 3) / 2) * 40
  if (/성숙|포화|안정|기존 시장/.test(pos)) x = Math.min(90, x + 25)
  if (/초기|신규|신생|blue ocean|블루오션/.test(pos)) x = Math.max(10, x - 25)
  if (/통합|올인원|복합|플랫폼|포괄/.test(pos)) y = Math.min(90, y + 25)
  if (/단순|심플|니치|특화|단일/.test(pos)) y = Math.max(10, y - 20)
  return { x: Math.round(x), y: Math.round(y) }
}

export interface CompetitorTierChartProps {
  competitors: Competitor[]
  className?: string
}

/**
 * Competitor Tier Chart – groups competitors into Leader / Emerging / Early-stage.
 */
export function CompetitorTierChart({ competitors, className }: CompetitorTierChartProps) {
  if (competitors.length === 0) return null

  const byTier = competitors.reduce(
    (acc, c, i) => {
      const tier = inferTier(c, i, competitors.length)
      if (!acc[tier]) acc[tier] = []
      acc[tier].push({ ...c, index: i })
      return acc
    },
    {} as Record<Tier, Array<Competitor & { index: number }>>
  )

  const order: Tier[] = ['leader', 'challenger', 'niche', 'emerging']

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          경쟁사 티어 차트
        </p>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          <Users className="h-3 w-3" />
          {competitors.length}개 경쟁사
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {order.map((tier) => {
          const items = byTier[tier] ?? []
          if (items.length === 0) return null
          const config = TIER_CONFIG[tier]
          const Icon = config.icon
          return (
            <div
              key={tier}
              title={config.description}
              className={cn(
                'rounded-xl border-2 p-4',
                config.color
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold text-foreground">{config.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mb-3">{config.description}</p>
              <ul className="space-y-2">
                {items.map((c, i) => (
                  <li key={`${c.name}-${i}`} className="text-sm">
                    <span className="font-medium text-foreground">{c.name || '이름 없음'}</span>
                    {c.positioning && (
                      <span className="text-muted-foreground text-xs block mt-0.5 truncate">
                        {c.positioning}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export interface CompetitorLandscapeMapProps {
  competitors: Competitor[]
  className?: string
}

/**
 * Competitor Landscape Map – 2D plot with X: Market maturity, Y: Product complexity.
 * Plots competitor companies to show competition density.
 */
export function CompetitorLandscapeMap({ competitors, className }: CompetitorLandscapeMapProps) {
  if (competitors.length === 0) return null

  const points = competitors.map((c, i) => ({
    ...c,
    ...inferPosition(c, i, competitors.length),
  }))

  const padding = 36
  const w = 320
  const h = 220
  const plotW = w - 2 * padding
  const plotH = h - 2 * padding

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          경쟁사 포지셔닝 맵
        </p>
        <span className="text-[10px] text-muted-foreground">
          X: 시장 성숙도 · Y: 제품 복잡도
        </span>
      </div>
      <div className="rounded-xl border border-border/60 bg-muted/5 p-4 overflow-hidden">
        <div
          className="relative w-full"
          style={{ aspectRatio: `${w} / ${h}` }}
        >
          <svg
            viewBox={`0 0 ${w} ${h}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Quadrant background (light) */}
            <rect x={padding} y={padding} width={plotW / 2} height={plotH / 2} fill="currentColor" fillOpacity={0.03} className="text-foreground" />
            <rect x={padding + plotW / 2} y={padding} width={plotW / 2} height={plotH / 2} fill="currentColor" fillOpacity={0.02} className="text-foreground" />
            <rect x={padding} y={padding + plotH / 2} width={plotW / 2} height={plotH / 2} fill="currentColor" fillOpacity={0.02} className="text-foreground" />
            <rect x={padding + plotW / 2} y={padding + plotH / 2} width={plotW / 2} height={plotH / 2} fill="currentColor" fillOpacity={0.04} className="text-foreground" />
            {/* Grid lines */}
            <line x1={padding} y1={h - padding} x2={w - padding} y2={h - padding} stroke="currentColor" strokeWidth={1} className="text-border" />
            <line x1={padding} y1={padding} x2={padding} y2={h - padding} stroke="currentColor" strokeWidth={1} className="text-border" />
            <line x1={padding + plotW / 2} y1={padding} x2={padding + plotW / 2} y2={h - padding} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 2" className="text-border/60" />
            <line x1={padding} y1={padding + plotH / 2} x2={w - padding} y2={padding + plotH / 2} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 2" className="text-border/60" />
            {/* Axis labels */}
            <text x={w / 2 - 40} y={h - 8} fontSize={10} fill="currentColor" className="text-muted-foreground fill-muted-foreground font-medium">시장 성숙도 →</text>
            <text x={12} y={h / 2 + 5} fontSize={10} fill="currentColor" className="text-muted-foreground fill-muted-foreground font-medium" transform={`rotate(-90, 12, ${h / 2})`}>제품 복잡도 ↑</text>
            {/* Quadrant labels (subtle) */}
            <text x={padding + plotW / 4 - 20} y={padding + 12} fontSize={8} fill="currentColor" fillOpacity={0.5} className="text-muted-foreground">초기</text>
            <text x={padding + (3 * plotW) / 4 - 25} y={padding + 12} fontSize={8} fill="currentColor" fillOpacity={0.5} className="text-muted-foreground">성숙</text>
            {/* Plot competitors – color by tier (Leader=amber, Emerging=primary, Early-stage=emerald) */}
            {points.map((p, i) => {
              const tier = inferTier(p, i, competitors.length)
              const tierColors: Record<Tier, { fill: string; stroke: string }> = {
                leader: { fill: '#3b82f6', stroke: '#2563eb' },
                challenger: { fill: '#10b981', stroke: '#059669' },
                niche: { fill: '#f59e0b', stroke: '#d97706' },
                emerging: { fill: '#9ca3af', stroke: '#6b7280' },
              }
              const { fill, stroke } = tierColors[tier]
              const px = padding + (p.x / 100) * plotW
              const py = h - padding - (p.y / 100) * plotH
              return (
                <g key={`${p.name}-${i}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={Math.max(5, 8 - competitors.length * 0.4)}
                    fill={fill}
                    fillOpacity={0.85}
                    stroke="var(--background, #fff)"
                    strokeWidth={1.5}
                  />
                  <title>{`${p.name}${p.positioning ? `: ${p.positioning}` : ''} (${TIER_CONFIG[tier].labelEn})`}</title>
                </g>
              )
            })}
          </svg>
          {/* Legend: tier categories + competitor names below map */}
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {(['leader', 'challenger', 'niche', 'emerging'] as const).map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', TIER_CONFIG[t].dotColor)} />
                  {TIER_CONFIG[t].label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {points.slice(0, 6).map((p, i) => {
                const tier = inferTier(p, i, competitors.length)
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs"
                    title={p.positioning ?? undefined}
                  >
                    <span className={cn('w-2 h-2 rounded-full shrink-0', TIER_CONFIG[tier].dotColor)} />
                    <span className="font-medium text-foreground truncate max-w-[100px]">{p.name}</span>
                  </span>
                )
              })}
              {points.length > 6 && (
                <span className="text-xs text-muted-foreground">+{points.length - 6}개</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
