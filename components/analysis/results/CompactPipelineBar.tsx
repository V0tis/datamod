'use client'

import { Fragment } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Compass,
  Database,
  FileText,
  Globe,
  Lightbulb,
  ListChecks,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  PIPELINE_TIMELINE_UI_STAGES,
  type PipelineTimelineBuiltStage,
} from '@/lib/analysis/build-pipeline-timeline-stages'

const STAGE_ICONS: Record<string, LucideIcon> = {
  cache: Database,
  collect: Globe,
  issues: FileText,
  trend: TrendingUp,
  competitor: Target,
  insight: Lightbulb,
  strategy: Compass,
  action: ListChecks,
  risk: AlertTriangle,
}

const SHORT_LABEL: Record<string, string> = {
  cache: '캐시',
  collect: '수집',
  issues: '이슈',
  trend: '흐름',
  competitor: '경쟁',
  insight: '인사이트',
  strategy: '전략',
  action: 'PM액션',
  risk: '리스크',
}

type NodeUiStatus = 'done' | 'running' | 'error' | 'pending' | 'skipped'

function mapStageStatus(s: PipelineTimelineBuiltStage['status']): NodeUiStatus {
  if (s === 'done') return 'done'
  if (s === 'running') return 'running'
  if (s === 'error') return 'error'
  if (s === 'skipped') return 'skipped'
  return 'pending'
}

function StepNode({ status, icon: Icon }: { status: NodeUiStatus; icon: LucideIcon }) {
  const configs: Record<
    NodeUiStatus,
    { bg: string; iconColor: string; ring: boolean; showCheck: boolean }
  > = {
    done: { bg: '#0D9F6E', iconColor: '#ffffff', ring: false, showCheck: true },
    running: { bg: '#EEF3FD', iconColor: '#1B64DA', ring: true, showCheck: false },
    error: { bg: '#FEF2F2', iconColor: '#DC2626', ring: false, showCheck: false },
    pending: { bg: '#F3F4F6', iconColor: '#D1D5DB', ring: false, showCheck: false },
    skipped: { bg: '#F3F4F6', iconColor: '#9CA3AF', ring: false, showCheck: false },
  }
  const c = configs[status]

  return (
    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
      <div
        className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: c.bg }}
      >
        {c.showCheck ? (
          <Check className="h-3.5 w-3.5" style={{ color: c.iconColor }} strokeWidth={2.5} aria-hidden />
        ) : (
          <Icon className="h-3.5 w-3.5" style={{ color: c.iconColor }} strokeWidth={2} aria-hidden />
        )}
      </div>
      {c.ring ? (
        <div
          className="pointer-events-none absolute inset-0 z-0 rounded-lg border-2 border-blue-400 opacity-60 animate-ping"
          aria-hidden
        />
      ) : null}
    </div>
  )
}

function ConnectorLine({ left, right }: { left: NodeUiStatus; right: NodeUiStatus }) {
  const filled = left === 'done' || left === 'skipped'
  return (
    <div
      className={cn(
        'mx-0.5 h-0.5 min-w-[6px] flex-1 self-center rounded-full sm:mx-1',
        filled ? 'bg-emerald-400/90' : 'bg-[var(--dm-color-border)]'
      )}
      aria-hidden
    />
  )
}

export interface CompactPipelineBarProps {
  stages: PipelineTimelineBuiltStage[]
  isRunning: boolean
  className?: string
}

export function CompactPipelineBar({ stages, isRunning, className }: CompactPipelineBarProps) {
  const total = stages.length || PIPELINE_TIMELINE_UI_STAGES.length
  const completedCount = stages.filter((s) => s.status === 'done' || s.status === 'skipped').length

  const runningIdx = stages.findIndex((s) => s.status === 'running')
  const currentMeta =
    runningIdx >= 0 ? PIPELINE_TIMELINE_UI_STAGES.find((x) => x.id === stages[runningIdx]?.id) : undefined

  return (
    <div
      className={cn(
        'border-b border-[var(--dm-color-border)] bg-[var(--dm-color-surface)] px-4 py-3 sm:px-6',
        className
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--dm-color-primary)]" />
              <span className="text-sm font-medium text-[var(--dm-color-primary)]">분석 진행 중</span>
              <span className="text-sm tabular-nums text-[var(--dm-color-text-muted)]">
                {completedCount}/{total}단계
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-[var(--dm-color-success)]" aria-hidden />
              <span className="text-sm font-semibold text-[var(--dm-color-success)]">분석 완료</span>
            </div>
          )}
        </div>
        {isRunning && currentMeta ? (
          <span className="text-xs text-[var(--dm-color-text-muted)]">
            현재: {currentMeta.label} · 예상 {currentMeta.eta} 남음
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stages.map((stage, index) => {
          const Icon = STAGE_ICONS[stage.id] ?? Database
          const ui = mapStageStatus(stage.status)
          const short = SHORT_LABEL[stage.id] ?? stage.id
          return (
            <Fragment key={stage.id}>
              <div className="flex min-w-[56px] flex-col items-center sm:min-w-[64px]">
                <StepNode status={ui} icon={Icon} />
                <span
                  className={cn(
                    'mt-1 max-w-[4.5rem] text-center text-[10px] font-medium leading-tight',
                    ui === 'running' && 'text-[var(--dm-color-primary)]',
                    ui === 'done' && 'text-[var(--dm-color-success)]',
                    ui === 'skipped' && 'text-[var(--dm-color-text-muted)]',
                    ui === 'error' && 'text-[var(--dm-color-danger)]',
                    ui === 'pending' && 'text-[var(--dm-color-text-muted)]'
                  )}
                >
                  {short}
                </span>
              </div>
              {index < stages.length - 1 ? (
                <ConnectorLine
                  left={mapStageStatus(stages[index].status)}
                  right={mapStageStatus(stages[index + 1].status)}
                />
              ) : null}
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
