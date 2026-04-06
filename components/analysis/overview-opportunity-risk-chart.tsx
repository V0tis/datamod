'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { analysisCardClass } from '@/components/analysis/analysis-card'
import { cn } from '@/lib/utils'

export function OverviewOpportunityRiskChart({
  result,
  className,
}: {
  result: ResearchResponse | null
  className?: string
}) {
  const score = typeof result?.key_metrics?.opportunity_score === 'number' ? result.key_metrics.opportunity_score : 50
  const s = Math.min(100, Math.max(0, Math.round(score)))
  const riskProxy = Math.min(100, Math.max(0, 100 - s))
  const data = [
    { name: '기회 지수', value: s, fill: '#0EA5E9' },
    { name: '리스크 압력', value: riskProxy, fill: '#F97316' },
  ]

  return (
    <div className={cn(analysisCardClass, 'p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">기회 vs 리스크 스냅샷</h3>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
            <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 11 }} stroke="#64748b" />
            <Tooltip
              formatter={(v: number) => [`${v}`, '']}
              contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28}>
              {data.map((e, i) => (
                <Cell key={i} fill={e.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
