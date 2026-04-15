'use client'

import { useState } from 'react'
import { Target, Copy, Bookmark, FileDown, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface StrategicActionItem {
  id: string
  title: string
  description: string
  opportunity: string
}

export interface StrategicActionsSectionProps {
  actions: StrategicActionItem[]
  loading?: boolean
  onSaveAction?: (action: StrategicActionItem) => void
  className?: string
}

function formatActionForClipboard(a: StrategicActionItem): string {
  return `${a.title}\n\n상세 실행:\n${a.description}\n\n기대 효과:\n${a.opportunity}`
}

export function StrategicActionsSection({
  actions,
  loading = false,
  onSaveAction,
  className,
}: StrategicActionsSectionProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (action: StrategicActionItem) => {
    try {
      await navigator.clipboard.writeText(formatActionForClipboard(action))
      setCopiedId(action.id)
      toast.success('액션이 클립보드에 복사되었습니다.')
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  const handleExportAll = () => {
    try {
      const lines = actions.map((a, i) =>
        `## ${i + 1}. ${a.title}\n\n**상세 실행:**\n${a.description}\n\n**기대 효과:**\n${a.opportunity}`
      ).join('\n\n---\n\n')
      const md = `# 전략 액션\n\n${lines}`
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `strategic-actions-${Date.now()}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('전략 액션을 내보냈습니다.')
    } catch {
      toast.error('내보내기에 실패했습니다.')
    }
  }

  if (loading && actions.length === 0) {
    return (
      <section className={cn(className)} aria-label="전략 액션">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            전략 액션
          </h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-md bg-muted/25 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (actions.length === 0) return null

  return (
    <section className={cn('min-w-0', className)} aria-label="전략 액션">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          전략 액션
        </h2>
        <Button variant="ghost" size="sm" onClick={handleExportAll} className="gap-1.5 text-xs h-8">
          <FileDown className="h-3.5 w-3.5" />
          내보내기
        </Button>
      </div>

      <div className="rin-table-scroll -mx-0.5 overflow-x-auto rounded-md border border-border/50">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2.5 w-10">#</th>
              <th className="min-w-[140px] px-3 py-2.5">전략</th>
              <th className="min-w-[220px] px-3 py-2.5">상세 실행 방안</th>
              <th className="min-w-[180px] px-3 py-2.5">기대 효과</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right w-[7rem]">작업</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action, index) => (
              <tr
                key={action.id}
                className="border-b border-border/40 transition-colors hover:bg-muted/15 last:border-b-0"
              >
                <td className="align-top px-3 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                <td className="align-top px-3 py-3 font-medium text-foreground">{action.title}</td>
                <td className="align-top px-3 py-3 text-slate-600 dark:text-zinc-400 leading-snug">{action.description}</td>
                <td className="align-top px-3 py-3 text-slate-600 dark:text-zinc-400 leading-snug">{action.opportunity}</td>
                <td className="align-top px-3 py-3">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(action)}
                      className="gap-1 h-8 px-2 text-xs"
                    >
                      {copiedId === action.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      복사
                    </Button>
                    {onSaveAction && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSaveAction(action)}
                        className="gap-1 h-8 px-2 text-xs"
                      >
                        <Bookmark className="h-3.5 w-3.5" />
                        저장
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
