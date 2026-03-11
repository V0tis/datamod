'use client'

import {
  BarChart3,
  Lightbulb,
  Target,
  Zap,
  CheckSquare2,
  FlaskConical,
  Users2,
  Layers,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StreamingBulletList } from './StreamingInsightText'
import { SectionContentSkeleton } from './SectionContentSkeleton'
import type { ResearchResponse } from '@/lib/stores/research-store'

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  mvp_experiment: { label: 'MVP 실험', icon: FlaskConical },
  user_interview: { label: '사용자 인터뷰', icon: Users2 },
  feature_prioritization: { label: '기능 우선순위', icon: Layers },
  go_to_market: { label: 'Go-to-Market 테스트', icon: Rocket },
}

const PRIORITY_COLORS = {
  high: 'text-destructive font-semibold',
  medium: 'text-amber-600 dark:text-amber-500 font-medium',
  low: 'text-muted-foreground',
} as const

function ActionCard({
  action,
}: {
  action: {
    action_title: string
    description?: string
    expected_outcome?: string
    priority?: string
  }
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/5 p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-foreground">{action.action_title}</h4>
        {action.priority && (
          <span
            className={cn(
              'text-[11px] uppercase tracking-wider',
              PRIORITY_COLORS[action.priority as keyof typeof PRIORITY_COLORS] ??
                PRIORITY_COLORS.medium
            )}
          >
            {action.priority}
          </span>
        )}
      </div>
      {action.description && (
        <p className="text-sm text-muted-foreground">{action.description}</p>
      )}
      {action.expected_outcome && (
        <div className="rounded bg-primary/5 border border-primary/10 px-2.5 py-2">
          <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-0.5">
            기대 결과
          </p>
          <p className="text-sm text-foreground">{action.expected_outcome}</p>
        </div>
      )}
    </div>
  )
}

export interface ProductStrategyResultProps {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  loading?: boolean
  keyword?: string
}

export function ProductStrategyResult({
  result,
  taskData = {},
  loading = false,
  keyword = '',
}: ProductStrategyResultProps) {
  const km = result?.key_metrics ?? {}
  const strategyOutput = (taskData.strategy_generation as { opportunities?: string[]; strategy_summary?: string } | undefined)
  const executionOutput = (taskData.execution_layer as {
    product_idea?: string
    target_customer?: string
    monetization?: string
    go_to_market_steps?: string[]
  } | undefined)

  // 1. Market Summary (short)
  const marketSummary =
    km.market_summary ??
    km.summary_insights ??
    strategyOutput?.strategy_summary ??
    ''

  // 2. Key Strategic Insights (3–5 bullets)
  const keyStrategicInsights =
    Array.isArray(km.key_strategic_insights) && km.key_strategic_insights.length > 0
      ? km.key_strategic_insights.slice(0, 5)
      : (result?.keyConclusions ?? (km.keyConclusions as string[] | undefined) ?? [])
          .slice(0, 5)

  // 3. Opportunity Areas
  const opportunityAreas =
    Array.isArray(km.opportunity_areas) && km.opportunity_areas.length > 0
      ? km.opportunity_areas
      : Array.isArray(strategyOutput?.opportunities)
        ? strategyOutput.opportunities
        : (km.positive_signals ?? result?.marketNews ?? []).slice(0, 5)

  // 4. Recommended Product Strategy
  const strategy = km.recommended_product_strategy
  const productIdea = strategy?.product_idea ?? executionOutput?.product_idea ?? undefined
  const targetCustomer = strategy?.target_customer ?? executionOutput?.target_customer ?? undefined
  const monetization = strategy?.monetization ?? executionOutput?.monetization ?? undefined
  const strategySummary =
    strategy?.summary ?? km.summary_insights ?? strategyOutput?.strategy_summary ?? ''

  // 5. PM Action Plan
  const pmActionPlan = km.pm_action_plan ?? []
  const fallbackActions = (km.pm_actions?.recommended_actions ?? []).map((a) => ({
    action_title: a.title,
    description: a.reasoning,
    expected_outcome: a.reasoning,
    priority: (a.urgency_level ?? 'medium') as 'high' | 'medium' | 'low',
    category: undefined as string | undefined,
  }))
  const allActions = pmActionPlan.length > 0 ? pmActionPlan : fallbackActions

  const hasContent =
    marketSummary ||
    keyStrategicInsights.length > 0 ||
    opportunityAreas.length > 0 ||
    (productIdea || targetCustomer || monetization || strategySummary) ||
    allActions.length > 0

  if (!hasContent && !loading) return null

  return (
    <div id="section-product-strategy" className="scroll-mt-24 space-y-6">
      {/* 1. Market Summary */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          Market Summary
        </h2>
        {loading && !marketSummary ? (
          <SectionContentSkeleton variant="list" />
        ) : marketSummary ? (
          <p className="text-sm text-foreground leading-relaxed">{marketSummary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">시장 요약을 생성 중입니다.</p>
        )}
      </section>

      {/* 2. Key Strategic Insights */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
          <Lightbulb className="h-5 w-5 text-primary" />
          Key Strategic Insights
        </h2>
        {loading && keyStrategicInsights.length === 0 ? (
          <SectionContentSkeleton variant="list" />
        ) : keyStrategicInsights.length > 0 ? (
          <StreamingBulletList
            items={keyStrategicInsights}
            streaming={loading}
            skipAnimation={!loading}
            revealDelayMs={200}
            variant="default"
          />
        ) : (
          <p className="text-sm text-muted-foreground">핵심 인사이트가 아직 없습니다.</p>
        )}
      </section>

      {/* 3. Opportunity Areas */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
          <Zap className="h-5 w-5 text-primary" />
          Opportunity Areas
        </h2>
        {loading && opportunityAreas.length === 0 ? (
          <SectionContentSkeleton variant="list" />
        ) : opportunityAreas.length > 0 ? (
          <ul className="space-y-2 list-none pl-0">
            {opportunityAreas.map((area, i) => (
              <li key={i} className="flex gap-2 text-sm rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-primary shrink-0 mt-0.5">•</span>
                <span className="text-foreground">{area}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">기회 영역이 아직 없습니다.</p>
        )}
      </section>

      {/* 4. Recommended Product Strategy */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
          <Target className="h-5 w-5 text-primary" />
          Recommended Product Strategy
        </h2>
        {loading && !productIdea && !targetCustomer && !monetization && !strategySummary ? (
          <SectionContentSkeleton variant="mixed" />
        ) : productIdea || targetCustomer || monetization || strategySummary ? (
          <div className="space-y-4">
            {strategySummary && (
              <p className="text-sm text-foreground leading-relaxed">{strategySummary}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {productIdea && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    제품 아이디어
                  </p>
                  <p className="text-sm text-foreground">{productIdea}</p>
                </div>
              )}
              {targetCustomer && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    타겟 고객
                  </p>
                  <p className="text-sm text-foreground">{targetCustomer}</p>
                </div>
              )}
              {monetization && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    수익화 모델
                  </p>
                  <p className="text-sm text-foreground">{monetization}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">제품 전략을 생성 중입니다.</p>
        )}
      </section>

      {/* 5. PM Action Plan */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <CheckSquare2 className="h-5 w-5 text-primary" />
          PM Action Plan
        </h2>
        {loading && allActions.length === 0 ? (
          <SectionContentSkeleton variant="list" />
        ) : allActions.length > 0 ? (
          <div className="space-y-6">
            {(() => {
              const hasCategories = allActions.some(
                (a) => a.category && CATEGORY_LABELS[a.category as keyof typeof CATEGORY_LABELS]
              )
              if (hasCategories) {
                return (['mvp_experiment', 'user_interview', 'feature_prioritization', 'go_to_market'] as const).map(
                  (cat) => {
                    const items = allActions.filter(
                      (a) => (a.category ?? '').toLowerCase() === cat
                    )
                    if (items.length === 0) return null
                    const meta = CATEGORY_LABELS[cat]
                    const Icon = meta.icon
                    return (
                      <div key={cat}>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4" />
                          {meta.label}
                        </h3>
                        <div className="space-y-3">
                          {items.map((action, i) => (
                            <ActionCard key={i} action={action} />
                          ))}
                        </div>
                      </div>
                    )
                  }
                )
              }
              const uncategorized = allActions.filter(
                (a) => !a.category || !CATEGORY_LABELS[a.category as keyof typeof CATEGORY_LABELS]
              )
              return (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-2">
                    <CheckSquare2 className="h-4 w-4" />
                    실행 액션
                  </h3>
                  <div className="space-y-3">
                    {uncategorized.map((action, i) => (
                      <ActionCard key={i} action={action} />
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">PM 액션 플랜이 아직 없습니다.</p>
        )}
      </section>
    </div>
  )
}
