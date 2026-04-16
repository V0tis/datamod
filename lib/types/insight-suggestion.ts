/**
 * 실시간 인사이트 제안 API — 현재 분석 컨텍스트만 사용 (research_history 집계 없음).
 */
export type InsightSuggestionRequestBody = {
  keyword: string
  country_code?: string
  /** 트렌드 단계 요약 */
  trend_summary?: string
  growth_signals?: string[]
  /** 경쟁 환경 (현재 리포트 task 또는 key_metrics) */
  competitive_landscape?: unknown[]
  market_structure?: string
  strategic_gaps?: { functional?: string[]; pricing?: string[]; summary?: string }
  /** 뉴스·소스 (제목 위주) */
  news_items?: Array<{ title?: string; publisher?: string }>
  /** 시장 뉴스 불릿 문자열 */
  market_news_lines?: string[]
  /** 리스크·부정 시그널 */
  negative_signals?: string[]
}

export type InsightSuggestionResult = {
  opportunity_score: number
  risk_score: number
  /** 저|중|고 등 표시용 */
  risk_grade: string
  attractiveness_grade: string
  /** 전략적 가치가 가장 높은 키워드 (보통 현재 분석 키워드) */
  focus_market_keyword: string
  /** "이 시장은 [A]가 [B]를 해결하지 못하고 있어, 우리가 [C]로 진입 시 …" 형태 */
  rationale_one_liner: string
  competition_overview: string
  market_issue: string
  recommended_action: string
  used_fallback?: boolean
}
