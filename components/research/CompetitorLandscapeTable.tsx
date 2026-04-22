'use client'

import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CompetitorTableEntry = {
  name?: string
  positioning?: string
  target_market?: string
  key_feature?: string
  pricing?: string
  differentiation?: string
  competitor_gap?: string
  our_differentiation?: string
  strength?: string
  weakness?: string
}

export interface CompetitorLandscapeTableProps {
  competitors: CompetitorTableEntry[]
  loading?: boolean
  className?: string
}

/** 모델이 모든 행에 반복하는 범용 마케팅 문구 제거 */
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

const HEADERS = ['경쟁사', '타겟 시장', '핵심 기능', '가격', '경쟁 격차', '우리 대응'] as const

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
        'max-w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80',
        className
      )}
      aria-label="경쟁사 분석 테이블"
    >
      <div className="border-b border-border px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground">
          <Target className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          경쟁사 분석
        </h2>
      </div>
      {loading && filtered.length === 0 ? (
        <div className="p-4">
          <div className="h-32 animate-pulse rounded-lg bg-muted/30" />
        </div>
      ) : (
        <div className="rin-table-scroll">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border">
                {HEADERS.map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c, i) => {
                const gapRaw = c.competitor_gap || c.weakness || ''
                const gap = gapRaw ? scrubDifferentiationFluff(gapRaw) : ''
                const oursRaw = c.our_differentiation || ''
                const ours = oursRaw ? scrubDifferentiationFluff(oursRaw) : ''
                const fallbackGap = !gap && c.differentiation ? scrubDifferentiationFluff(c.differentiation) : ''
                return (
                  <tr
                    key={`competitor-row-${String(c.name ?? 'x')}-${i}`}
                    className="group transition-colors hover:bg-muted/30"
                  >
                    <td className="px-3 py-4 align-top">
                      <div className="font-medium text-foreground">{c.name ?? '—'}</div>
                      {c.positioning ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.positioning}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-4 align-top text-muted-foreground">{c.target_market?.trim() || '—'}</td>
                    <td className="px-3 py-4 align-top text-muted-foreground">{c.key_feature?.trim() || '—'}</td>
                    <td className="px-3 py-4 align-top">
                      <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {c.pricing?.trim() || '—'}
                      </span>
                    </td>
                    <td className="max-w-[200px] px-3 py-4 align-top">
                      {gap || fallbackGap ? (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">{gap || fallbackGap}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="max-w-[200px] px-3 py-4 align-top">
                      {ours ? (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{ours}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
