'use client'

import { Crown, TrendingUp, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Competitor = { name?: string; positioning?: string; strength?: string; weakness?: string }

type Tier = 'leader' | 'emerging' | 'early'

const TIER_CONFIG: Record<Tier, { label: string; labelEn: string; icon: typeof Crown; color: string }> = {
  leader: { label: '리더', labelEn: 'Leader', icon: Crown, color: 'border-amber-500/50 bg-amber-500/10' },
  emerging: { label: '성장기', labelEn: 'Emerging', icon: TrendingUp, color: 'border-primary/50 bg-primary/10' },
  early: { label: '초기 스타트업', labelEn: 'Early-stage', icon: Zap, color: 'border-emerald-500/50 bg-emerald-500/10' },
}

/** Infer tier from positioning text or index order */
function inferTier(c: Competitor, index: number, total: number): Tier {
  const pos = (c.positioning ?? '').toLowerCase()
  if (/리더|선도|1위|시장 지배|대표|최대/.test(pos)) return 'leader'
  if (/초기|스타트업|신규|신생|초창기/.test(pos)) return 'early'
  if (/성장|확대|성장기|부상|신흥/.test(pos)) return 'emerging'
  if (total <= 3) return index === 0 ? 'leader' : 'emerging'
  if (index < Math.ceil(total / 3)) return 'leader'
  if (index < Math.ceil((2 * total) / 3)) return 'emerging'
  return 'early'
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

  const order: Tier[] = ['leader', 'emerging', 'early']

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Competitor Tier Chart
        </p>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          <Users className="h-3 w-3" />
          {competitors.length}개 경쟁사
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {order.map((tier) => {
          const items = byTier[tier] ?? []
          if (items.length === 0) return null
          const config = TIER_CONFIG[tier]
          const Icon = config.icon
          return (
            <div
              key={tier}
              className={cn(
                'rounded-xl border-2 p-4',
                config.color
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold text-foreground">{config.label}</span>
                <span className="text-[10px] text-muted-foreground">({config.labelEn})</span>
              </div>
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
          Competitor Landscape Map
        </p>
        <span className="text-[10px] text-muted-foreground">
          X: Market maturity · Y: Product complexity
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
            <text x={w / 2 - 55} y={h - 8} fontSize={10} fill="currentColor" className="text-muted-foreground fill-muted-foreground font-medium">Market maturity →</text>
            <text x={12} y={h / 2 + 5} fontSize={10} fill="currentColor" className="text-muted-foreground fill-muted-foreground font-medium" transform={`rotate(-90, 12, ${h / 2})`}>Product complexity ↑</text>
            {/* Quadrant labels (subtle) */}
            <text x={padding + plotW / 4 - 20} y={padding + 12} fontSize={8} fill="currentColor" fillOpacity={0.5} className="text-muted-foreground">Early</text>
            <text x={padding + (3 * plotW) / 4 - 25} y={padding + 12} fontSize={8} fill="currentColor" fillOpacity={0.5} className="text-muted-foreground">Mature</text>
            {/* Plot competitors */}
            {points.map((p, i) => {
              const px = padding + (p.x / 100) * plotW
              const py = h - padding - (p.y / 100) * plotH
              return (
                <g key={`${p.name}-${i}`}>
                  <circle
                    cx={px}
                    cy={py}
                    r={Math.max(5, 8 - competitors.length * 0.4)}
                    fill="#6366f1"
                    fillOpacity={0.85}
                    stroke="var(--background, #fff)"
                    strokeWidth={1.5}
                  />
                  <title>{`${p.name}${p.positioning ? `: ${p.positioning}` : ''}`}</title>
                </g>
              )
            })}
          </svg>
          {/* Legend: competitor names below map (competition density) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {points.slice(0, 6).map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs"
                title={p.positioning ?? undefined}
              >
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="font-medium text-foreground truncate max-w-[100px]">{p.name}</span>
              </span>
            ))}
            {points.length > 6 && (
              <span className="text-xs text-muted-foreground">+{points.length - 6}개</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
