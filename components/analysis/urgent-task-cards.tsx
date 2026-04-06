'use client'

import { AlertTriangle, ClipboardList, Radar, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'
import { analysisCardClass } from '@/components/analysis/analysis-card'

type Props = {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{ step_name: string; output_data: unknown }> | null
  onNavigateTab: (tab: 'insight' | 'action') => void
}

export function UrgentTaskCards({ result, taskData, analysisTasks, onNavigateTab }: Props) {
  const actions = extractNextActionItems(result, taskData, analysisTasks, { maxItems: 20 })
  const highCount = actions.filter((a) => a.priority === 'high').length
  const totalStrategic = actions.length
  const km = result?.key_metrics ?? {}
  const risks = km.negative_risks ?? km.pm_actions?.decision_risks ?? []
  const monitoring = km.pm_actions?.monitoring_points ?? []
  const riskCount = Array.isArray(risks) ? risks.length : 0
  const monitorCount = Array.isArray(monitoring) ? monitoring.length : 0

  const items = [
    {
      key: 'urgent',
      count: highCount > 0 ? highCount : Math.min(totalStrategic, 5) || 0,
      label: '긴급 전략 과제',
      hint: highCount > 0 ? '우선 실행이 필요한 GTM·출시 과제입니다.' : '실행 대기 중인 전략 과제를 확인하세요.',
      icon: ClipboardList,
      cta: '실행 테이블로',
      tab: 'action' as const,
    },
    {
      key: 'risk',
      count: riskCount,
      label: '리스크 대응',
      hint: riskCount > 0 ? '의사결정·규제·경쟁 리스크에 대한 점검 항목입니다.' : '리스크 시그널이 충분히 수집되지 않았습니다.',
      icon: AlertTriangle,
      cta: '액션 탭',
      tab: 'action' as const,
    },
    {
      key: 'monitor',
      count: monitorCount,
      label: '모니터링 포인트',
      hint: monitorCount > 0 ? '시장·지표 추적이 필요한 체크포인트입니다.' : '모니터링 항목이 비어 있습니다.',
      icon: Radar,
      cta: '인사이트 탭',
      tab: 'insight' as const,
    },
  ] as const

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">긴급 액션</h3>
      <ul className="space-y-3">
        {items.map(({ key, count, label, hint, icon: Icon, cta, tab }) => (
          <li key={key} className={cn(analysisCardClass, 'p-4')}>
            <div className="flex items-start gap-3">
              <div className="flex shrink-0 flex-col items-center leading-none">
                <span
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    count > 0 ? 'text-slate-900 dark:text-zinc-50' : 'text-slate-300 dark:text-zinc-600'
                  )}
                >
                  {count}
                </span>
                <span className="text-[11px] font-medium text-slate-400">건</span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-50">
                  <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                  {label}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-zinc-400">{hint}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab(tab)}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-[#0EA5E9] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
            >
              {cta}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
