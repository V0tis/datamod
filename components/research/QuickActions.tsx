'use client'

import { Copy, FileDown, Share2, FolderPlus, Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface QuickActionsProps {
  keyInsight: string
  getMarkdownContent: () => string
  onSaveToWorkspace?: () => void
  disabled?: boolean
  className?: string
}

export function QuickActions({
  keyInsight,
  getMarkdownContent,
  onSaveToWorkspace,
  disabled = false,
  className,
}: QuickActionsProps) {
  const [copied, setCopied] = useState<'insight' | 'link' | null>(null)

  const handleCopyInsight = async () => {
    if (!keyInsight || disabled) return
    try {
      await navigator.clipboard.writeText(keyInsight)
      setCopied('insight')
      toast.success('인사이트가 클립보드에 복사되었습니다.')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  const handleExportMarkdown = () => {
    if (disabled) return
    try {
      const md = getMarkdownContent()
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `analysis-${Date.now()}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Markdown으로 내보냈습니다.')
    } catch {
      toast.error('내보내기에 실패했습니다.')
    }
  }

  const handleShareLink = async () => {
    if (disabled) return
    try {
      const url = typeof window !== 'undefined' ? window.location.href : ''
      await navigator.clipboard.writeText(url)
      setCopied('link')
      toast.success('링크가 클립보드에 복사되었습니다.')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error('링크 복사에 실패했습니다.')
    }
  }

  const handleSaveToWorkspace = () => {
    if (disabled || !onSaveToWorkspace) return
    onSaveToWorkspace()
  }

  const actions = [
    {
      id: 'copy',
      label: 'Copy Insight',
      icon: copied === 'insight' ? Check : Copy,
      onClick: handleCopyInsight,
      disabled: !keyInsight || disabled,
    },
    {
      id: 'markdown',
      label: 'Export as Markdown',
      icon: FileDown,
      onClick: handleExportMarkdown,
      disabled,
    },
    {
      id: 'share',
      label: 'Share link',
      icon: copied === 'link' ? Check : Share2,
      onClick: handleShareLink,
      disabled,
    },
    {
      id: 'save',
      label: 'Save to workspace',
      icon: FolderPlus,
      onClick: handleSaveToWorkspace,
      disabled: disabled || !onSaveToWorkspace,
    },
  ]

  return (
    <div
      className={cn(
        'flex flex-wrap gap-2',
        className
      )}
    >
      {actions.map(({ id, label, icon: Icon, onClick, disabled: actionDisabled }) => (
        <Button
          key={id}
          variant="secondary"
          size="sm"
          onClick={onClick}
          disabled={actionDisabled}
          className="gap-2"
        >
          <Icon
            className={cn(
              'h-4 w-4',
              (id === 'copy' && copied === 'insight') || (id === 'share' && copied === 'link')
                ? 'text-emerald-600'
                : ''
            )}
          />
          {label}
        </Button>
      ))}
    </div>
  )
}
