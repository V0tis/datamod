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
  return `${a.title}\n\nDescription:\n${a.description}\n\nOpportunity:\n${a.opportunity}`
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
        `## ${i + 1}. ${a.title}\n\n**Description:**\n${a.description}\n\n**Opportunity:**\n${a.opportunity}`
      ).join('\n\n---\n\n')
      const md = `# Strategic Actions\n\n${lines}`
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
      <section
        className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
        aria-label="Strategic Actions"
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            Strategic Actions
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg border border-border/60 bg-muted/20 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (actions.length === 0) return null

  return (
    <section
      className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
      aria-label="Strategic Actions"
    >
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Strategic Actions
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportAll}
            className="gap-1.5 text-xs"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>

        <ul className="space-y-4">
          {actions.map((action, index) => (
            <li
              key={action.id}
              className="rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-5"
            >
              <p className="text-xs font-medium text-primary mb-1">
                {index + 1}. {action.title}
              </p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Description
                  </p>
                  <p className="text-foreground leading-relaxed">{action.description}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Opportunity
                  </p>
                  <p className="text-foreground leading-relaxed">{action.opportunity}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(action)}
                  className="gap-1.5 text-xs h-8"
                >
                  {copiedId === action.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  Copy
                </Button>
                {onSaveAction && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSaveAction(action)}
                    className="gap-1.5 text-xs h-8"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Save
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
