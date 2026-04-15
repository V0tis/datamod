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
  /** 경쟁사 미집중 영역 */
  competitor_gap?: string
  /** 우리 차별화 */
  our_differentiation?: string
  strength?: string
  weakness?: string
}

export interface CompetitorLandscapeTableProps {
  competitors: CompetitorTableEntry[]
  loading?: boolean
  className?: string
}

const COLUMNS = [
  { key: 'name', label: 'COMPETITOR', className: 'font-semibold' },
  { key: 'target_market', label: 'TARGET MARKET' },
  { key: 'key_feature', label: 'KEY FEATURE' },
  { key: 'pricing', label: 'PRICING' },
  { key: 'differentiation', label: 'DIFFERENTIATION' },
] as const

/** 모델이 모든 행에 반복하는 범용 마케팅 문구 제거(행별 고유 인사이트만 남기기 위한 보조) */
function scrubDifferentiationFluff(s: string): string {
  const patterns = [
    /이용자(?:의)?\s*니즈를\s*충족(?:시킬\s*수\s*있(?:습니다|다)|합니다)/gi,
    /사용자(?:의)?\s*(?:요구|니즈)를\s*만족(?:시킵니다|시킬\s*수\s*있습니다)/gi,
    /차별화(?:된)?\s*(?:경험|서비스)를\s*제공합니다/gi,
    /시장(?:에서)?\s*경쟁\s*우위를\s*확보합니다/gi,
  ]
  let out = s.trim()
  for (const re of patterns) out = out.replace(re, '').replace(/\s{2,}/g, ' ').trim()
  out = out.replace(/^[,.\s:：]+|[,.\s:：]+$/g, '').trim()
  return out || s.trim()
}

export function CompetitorLandscapeTable({
  competitors,
  loading = false,
  className,
}: CompetitorLandscapeTableProps) {
  const filtered = competitors.filter((c) => c.name?.trim()).slice(0, 10)

  if (filtered.length === 0 && !loading) return null

  return (
    <section
      className={cn(
        'max-w-full min-w-0 rounded-xl border border-border/60 bg-card overflow-hidden',
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
          행마다 해당 경쟁사 기준 경쟁 공백·우리 대응(또는 요약)
        </p>
      </div>
      {loading && filtered.length === 0 ? (
        <div className="p-4">
          <div className="h-32 rounded-lg bg-muted/30 animate-pulse" />
        </div>
      ) : (
        <div className="rin-table-scroll">
          <table className="min-w-[640px] w-full text-sm">
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
              {filtered.map((c, i) => {
                const gap = c.competitor_gap ? scrubDifferentiationFluff(c.competitor_gap) : ''
                const ours = c.our_differentiation ? scrubDifferentiationFluff(c.our_differentiation) : ''
                const diffOnly = c.differentiation ? scrubDifferentiationFluff(c.differentiation) : ''
                return (
                  <tr
                    key={`competitor-row-${String(c.name ?? 'x')}-${i}`}
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
                    <td className="px-4 py-3 text-foreground align-top max-w-[min(360px,45vw)]">
                      {gap || ours ? (
                        <div className="space-y-2 text-xs leading-relaxed">
                          {gap ? (
                            <p>
                              <span className="font-semibold text-rose-600/90 dark:text-rose-400">경쟁 공백 </span>
                              <span className="text-foreground/90">{gap}</span>
                            </p>
                          ) : null}
                          {ours ? (
                            <p>
                              <span className="font-semibold text-emerald-700/90 dark:text-emerald-400">우리 대응 </span>
                              <span className="text-foreground/90">{ours}</span>
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs">{diffOnly || '—'}</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
