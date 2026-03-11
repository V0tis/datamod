'use client'

import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CompetitorTableEntry = {
  name?: string
  positioning?: string
  target_market?: string
  key_feature?: string
  pricing?: string
  differentiation?: string
  strength?: string
  weakness?: string
}

export interface CompetitorLandscapeTableProps {
  competitors: CompetitorTableEntry[]
  loading?: boolean
  className?: string
}

const COLUMNS = [
  { key: 'name', label: 'Competitor', className: 'font-semibold' },
  { key: 'target_market', label: 'Target Market' },
  { key: 'key_feature', label: 'Key Feature' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'differentiation', label: 'Differentiation' },
] as const

export function CompetitorLandscapeTable({
  competitors,
  loading = false,
  className,
}: CompetitorLandscapeTableProps) {
  const filtered = competitors.filter((c) => c.name?.trim()).slice(0, 10)
  const hasData = filtered.some(
    (c) =>
      c.target_market ||
      c.key_feature ||
      c.pricing ||
      c.differentiation ||
      c.positioning
  )

  if (filtered.length === 0 && !loading) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-card overflow-hidden',
        className
      )}
      aria-label="Competitor Landscape"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Competitor Landscape
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          경쟁사 비교: 타겟 시장, 핵심 기능, 가격, 차별화
        </p>
      </div>
      {loading && filtered.length === 0 ? (
        <div className="p-4">
          <div className="h-32 rounded-lg bg-muted/30 animate-pulse" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap',
                      col.key === 'name' && 'sticky left-0 bg-muted/30 z-10'
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr
                  key={`${c.name}-${i}`}
                  className="border-b border-border/40 hover:bg-muted/20 transition-colors"
                >
                  <td
                    className={cn(
                      'px-4 py-3 font-medium text-foreground align-top',
                      'sticky left-0 bg-card z-[1] hover:bg-muted/20'
                    )}
                  >
                    {c.name ?? '—'}
                    {c.positioning && (
                      <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                        {c.positioning}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground align-top max-w-[160px]">
                    {c.target_market || '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground align-top max-w-[180px]">
                    {c.key_feature || '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground align-top max-w-[120px]">
                    {c.pricing || '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground align-top max-w-[200px]">
                    {c.differentiation || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
