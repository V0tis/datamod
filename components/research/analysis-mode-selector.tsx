'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  type AnalysisMode,
  ANALYSIS_MODE_CONFIG,
  ANALYSIS_MODE_TOOLTIPS,
} from '@/lib/types/analysis-modes'
import { Zap, Target, Users, ListTodo, Clock, CheckCircle2, Play } from 'lucide-react'

const MODE_ICONS: Record<AnalysisMode, React.ElementType> = {
  standard: Play,
  quick: Zap,
  deep: Target,
  competitive: Users,
  action: ListTodo,
}

export type DepthMode = 'quick' | 'standard' | 'deep'

interface AnalysisModeSelectorProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
  disabled?: boolean
  className?: string
  showDescription?: boolean
  /** When set, only show these analysis depth options (Quick/Standard/Deep) */
  depthOnly?: boolean
}

export function AnalysisModeSelector({
  value,
  onChange,
  disabled = false,
  className,
  showDescription = true,
  depthOnly = false,
}: AnalysisModeSelectorProps) {
  const allModes = Object.values(ANALYSIS_MODE_CONFIG)
  const modes = depthOnly
    ? (['quick', 'standard', 'deep'] as const).map((id) => ANALYSIS_MODE_CONFIG[id])
    : allModes

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">분석 모드</span>
        <span className="text-xs text-muted-foreground">
          결과물의 깊이와 속도를 선택하세요
        </span>
      </div>
      <div className={cn('grid gap-2', depthOnly ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
        {modes.map((mode) => {
          const Icon = MODE_ICONS[mode.id]
          const isSelected = value === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              disabled={disabled}
              className={cn(
                'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all',
                'hover:border-primary/50 hover:bg-muted/50',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                  : 'border-border bg-card'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        'text-sm font-medium truncate',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {mode.labelKo}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span>{mode.duration}</span>
              </div>
            </button>
          )
        })}
      </div>

      {showDescription && (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
              {(() => {
                const Icon = MODE_ICONS[value]
                return <Icon className="h-3.5 w-3.5" />
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">
                  {ANALYSIS_MODE_CONFIG[value].labelKo}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ANALYSIS_MODE_CONFIG[value].label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {ANALYSIS_MODE_CONFIG[value].descriptionKo}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface AnalysisPreviewProps {
  mode: AnalysisMode
  className?: string
}

export function AnalysisPreview({ mode, className }: AnalysisPreviewProps) {
  const config = ANALYSIS_MODE_CONFIG[mode]

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">예상 결과물</span>
        <span className="text-xs text-muted-foreground">
          What You&apos;ll Get
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {config.outputs.map((output, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-foreground truncate">{output}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface CompactModeSelectorProps {
  value: AnalysisMode
  onChange: (mode: AnalysisMode) => void
  disabled?: boolean
  className?: string
}

export function CompactModeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: CompactModeSelectorProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const modes = Object.values(ANALYSIS_MODE_CONFIG)
  const selectedConfig = ANALYSIS_MODE_CONFIG[value]

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border">
        {modes.map((mode) => {
          const Icon = MODE_ICONS[mode.id]
          const isSelected = value === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              disabled={disabled}
              title={ANALYSIS_MODE_TOOLTIPS[mode.id]}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                isSelected
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{mode.labelKo}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={() => setAdvancedOpen((o) => !o)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
      >
        {advancedOpen ? 'Advanced (접기)' : 'Advanced (모듈 선택)'}
      </button>
      {advancedOpen && (
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-2">선택된 모드: {selectedConfig.labelKo}</p>
          <p className="mb-2">실행되는 단계:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {selectedConfig.steps.map((s) => (
              <li key={s.id}>{s.description}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
